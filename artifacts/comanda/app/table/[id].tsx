import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import type { Mesa, MesaStatus, Pedido, ItemPedido, PedidoStatus } from "../../lib/supabase/types";
import { i18n } from "../../constants/i18n";
import { triggerN8NWebhook } from "../../lib/n8n";
import { formatCurrency } from "../../lib/format";

import { useAuth } from "../../context/auth";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type PedidoComItens = Pedido & { itens: ItemPedido[] };

// ─── Queries Supabase ─────────────────────────────────────────────────────────
async function fetchMesa(id: string): Promise<Mesa | null> {
  const { data, error } = await supabase
    .from("comanda_mesas")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

async function fetchPedidosDaMesa(mesaId: string): Promise<PedidoComItens[]> {
  const { data: pedidos, error } = await supabase
    .from("comanda_pedidos")
    .select("*")
    .eq("mesa_id", mesaId)
    .not("status", "eq", "cancelado")
    .order("criado_em", { ascending: false });
  if (error || !pedidos) return [];

  const pedidosComItens = await Promise.all(
    (pedidos as any[]).map(async (p) => {
      const { data: itens } = await (supabase as any)
        .from("comanda_itens_pedido")
        .select("*")
        .eq("pedido_id", p.id);
      return { ...p, itens: itens ?? [] };
    })
  );
  return pedidosComItens;
}

async function atualizarStatusMesa(id: string, status: MesaStatus) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_mesas")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return i18n.common.ago(diff + "s");
  if (diff < 3600) return i18n.common.ago(Math.floor(diff / 60) + "min");
  return i18n.common.ago(Math.floor(diff / 3600) + "h");
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function TableDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [pedidos, setPedidos] = useState<PedidoComItens[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!id) return;
    const [mesaData, pedidosData] = await Promise.all([
      fetchMesa(id),
      fetchPedidosDaMesa(id),
    ]);
    setMesa(mesaData);
    setPedidos(pedidosData);
    if (mesaData) setClienteNome(mesaData.nome_cliente || "");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`mesa-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comanda_pedidos", filter: `mesa_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "comanda_mesas", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const handleSaveCliente = async () => {
    if (!mesa) return;
    try {
      // @ts-ignore
      const { error } = await (supabase as any)
        .from("comanda_mesas")
        .update({ nome_cliente: clienteNome })
        .eq("id", mesa.id);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleChangeStatus = async (status: MesaStatus) => {
    if (!mesa) return;
    
    // Se quiser liberar a mesa, primeiro escolher o pagamento
    // Mostramos o modal se a mesa estiver ocupada ou se houver valor na conta
    if (status === "disponivel" && (totalConta > 0 || mesa.status === "ocupada")) {
      console.log("[DEBUG] Abrindo modal de pagamento. Total:", totalConta, "Status atual:", mesa.status);
      setShowStatusModal(false);
      setShowPaymentModal(true);
      return;
    }

    setUpdatingStatus(true);
    try {
      await atualizarStatusMesa(mesa.id, status);
      await load();
      setShowStatusModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { console.error(e); }
    finally { setUpdatingStatus(false); }
  };

  const handleConfirmPayment = async (method: string) => {
    if (!mesa) return;
    setUpdatingStatus(true);
    try {
      // 1. Disparar Webhook com o meio de pagamento formatado para o Sheets
      const resumoPedidos = pedidos.map(p => {
        const itensStr = p.itens.map(i => `${i.quantidade}x ${i.nome_produto}${i.observacoes ? ` (${i.observacoes})` : ""}`).join(", ");
        return `- ${itensStr}`;
      }).join("\n");

      console.log("[DEBUG] Enviando fechamento para n8n:", method, "Total:", totalConta);
      await triggerN8NWebhook("fechamento_mesa", {
        mesa_id: mesa.id,
        mesa_numero: mesa.numero,
        restaurante_id: profile?.restaurante_id,
        mesero_nome: profile?.nome,
        total_final: totalConta,
        meio_pagamento: method,
        pedidos: resumoPedidos,
        detalhes_pedidos: pedidos.map(p => ({
          id: p.id,
          total: p.total,
          itens: p.itens.map(i => ({
            nome: i.nome_produto,
            quantidade: i.quantidade,
            subtotal: i.subtotal,
            observacoes: i.observacoes
          }))
        }))
      });

      // 2. Limpar histórico: desvincular pedidos da mesa e marcá-los como entregues
      // @ts-ignore
      await (supabase as any)
        .from("comanda_pedidos")
        .update({ mesa_id: null, status: "entregue" })
        .eq("mesa_id", mesa.id)
        .neq("status", "cancelado");

      // 3. Liberar mesa e limpar nome do cliente
      // @ts-ignore
      await (supabase as any)
        .from("comanda_mesas")
        .update({ status: "disponivel", nome_cliente: null })
        .eq("id", mesa.id);
      
      await load();
      setShowPaymentModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back(); // Voltar para a lista de mesas após o pagamento
    } catch (e) { 
      console.error(e); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { 
      setUpdatingStatus(false); 
    }
  };

  const totalConta = pedidos.reduce((sum, p) => sum + Number(p.total), 0);

  const statusOptions: Array<{ key: MesaStatus; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: "disponivel", label: i18n.tables.available, icon: "checkmark-circle-outline" },
    { key: "ocupada", label: i18n.tables.occupied, icon: "people-outline" },
    { key: "reservada", label: i18n.tables.reserved, icon: "calendar-outline" },
    { key: "limpeza", label: i18n.tables.cleaning, icon: "sparkles-outline" },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator color={Colors.amber} size="large" />
      </View>
    );
  }

  if (!mesa) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.errorText}>{i18n.tables.notFound}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{i18n.common.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = (Colors.statusColors as Record<string, string>)[mesa.status] ?? Colors.textMuted;
  const statusLabel = (Colors.statusLabels as Record<string, string>)[mesa.status] ?? mesa.status;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { router.back(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>{i18n.tables.tableName(mesa.numero)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { setShowStatusModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={styles.editButton}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Info Bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{i18n.tables.capacityValue(mesa.capacidade)}</Text>
        </View>
        {mesa.nome_cliente ? (
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>{mesa.nome_cliente}</Text>
          </View>
        ) : null}
        <View style={styles.infoItem}>
          <Ionicons name="receipt-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{i18n.details.ordersCount(pedidos.length)}</Text>
        </View>
      </View>

      {/* Nome do Cliente Card */}
      <View style={styles.clientCard}>
        <View style={styles.clientInputContainer}>
          <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.clientInput}
            value={clienteNome}
            onChangeText={setClienteNome}
            onBlur={handleSaveCliente}
            placeholder="Nome do cliente (ex: João)"
            placeholderTextColor={Colors.textMuted}
          />
          {clienteNome !== (mesa.nome_cliente || "") && (
            <TouchableOpacity onPress={handleSaveCliente}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.amber} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pedidos */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {pedidos.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{i18n.details.empty}</Text>
            <Text style={styles.emptySubtitle}>{i18n.details.emptySubtitle}</Text>
          </View>
        ) : (
          pedidos.map((pedido) => {
            const pStatusColor = (Colors.statusColors as Record<string, string>)[pedido.status] ?? Colors.textMuted;
            const pStatusLabel = (Colors.statusLabels as Record<string, string>)[pedido.status] ?? pedido.status;
            return (
              <View key={pedido.id} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <View style={styles.orderCardLeft}>
                    <Text style={styles.orderId}>{i18n.details.orderNumber(pedido.id.slice(-6).toUpperCase())}</Text>
                    <Text style={styles.orderTime}>{timeAgo(pedido.criado_em)}</Text>
                  </View>
                  <View style={[styles.orderStatusPill, { backgroundColor: pStatusColor + "22" }]}>
                    <Text style={[styles.orderStatusText, { color: pStatusColor }]}>{pStatusLabel}</Text>
                  </View>
                </View>

                {pedido.observacoes ? (
                  <View style={styles.orderGlobalNotes}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.amber} />
                    <Text style={styles.orderGlobalNotesText}>{pedido.observacoes}</Text>
                  </View>
                ) : null}

                {pedido.itens.map((item) => (
                  <View key={item.id} style={styles.orderItemRow}>
                    <Text style={styles.orderItemQty}>{item.quantidade}x</Text>
                    <View style={styles.orderItemInfo}>
                      <Text style={styles.orderItemName}>{item.nome_produto}</Text>
                      {item.observacoes ? <Text style={styles.orderItemNotes}>{item.observacoes}</Text> : null}
                    </View>
                    <Text style={styles.orderItemPrice}>
                      {formatCurrency(Number(item.subtotal))}
                    </Text>
                  </View>
                ))}

                <View style={styles.orderTotal}>
                  <Text style={styles.orderTotalLabel}>{i18n.details.orderTotal}</Text>
                  <Text style={styles.orderTotalValue}>{formatCurrency(Number(pedido.total))}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Rodapé */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
        {totalConta > 0 ? (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>{i18n.details.totalBill}</Text>
            <Text style={styles.billValue}>{formatCurrency(totalConta)}</Text>
          </View>
        ) : null}
        <View style={styles.footerButtons}>
          <TouchableOpacity
            onPress={() => {
              if (!mesa) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/order/new", params: { tableId: mesa.id, tableNumber: mesa.numero } });
            }}
            style={styles.primaryButton}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.espresso} />
            <Text style={styles.primaryButtonText}>{i18n.details.newOrder}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Pagamento */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPaymentModal(false)}>
          <View style={styles.statusModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.statusModalTitle}>{i18n.details.payment.title}</Text>
            
            <TouchableOpacity onPress={() => handleConfirmPayment("dinero")} style={styles.statusOption}>
              <Ionicons name="cash-outline" size={20} color={Colors.green} />
              <Text style={styles.statusOptionText}>{i18n.details.payment.cash}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleConfirmPayment("tarjeta")} style={styles.statusOption}>
              <Ionicons name="card-outline" size={20} color={Colors.blue} />
              <Text style={styles.statusOptionText}>{i18n.details.payment.card}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleConfirmPayment("transferencia")} style={styles.statusOption}>
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.amber} />
              <Text style={styles.statusOptionText}>{i18n.details.payment.transfer}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleConfirmPayment("otro")} style={styles.statusOption}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={Colors.textMuted} />
              <Text style={styles.statusOptionText}>{i18n.details.payment.other}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Status */}
      <Modal visible={showStatusModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusModal(false)}>
          <View style={styles.statusModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.statusModalTitle}>{i18n.details.changeStatus}</Text>
            {statusOptions.map((opt) => {
              const optColor = (Colors.statusColors as Record<string, string>)[opt.key] ?? Colors.textMuted;
              const isActive = mesa.status === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => handleChangeStatus(opt.key)}
                  style={[styles.statusOption, isActive && { backgroundColor: optColor + "22" }]}
                  disabled={updatingStatus}
                >
                  <Ionicons name={opt.icon} size={20} color={isActive ? optColor : Colors.textSecondary} />
                  <Text style={[styles.statusOptionText, isActive && { color: optColor }]}>{opt.label}</Text>
                  {isActive ? <Ionicons name="checkmark" size={18} color={optColor} style={{ marginLeft: "auto" }} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, gap: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.textPrimary, letterSpacing: -0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  editButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center" },
  infoBar: { flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingBottom: 16, flexWrap: "wrap" },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  emptyOrders: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.textSecondary },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textMuted },
  orderCard: { backgroundColor: Colors.charcoal, borderRadius: 16, padding: 16, marginBottom: 4 },
  orderCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  orderCardLeft: { gap: 2 },
  orderId: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  orderTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  orderGlobalNotes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warmDark,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
  },
  orderGlobalNotesText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  orderStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  orderStatusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  orderItemRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.warmDark, gap: 10 },
  orderItemQty: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.amber, width: 24 },
  orderItemInfo: { flex: 1 },
  orderItemName: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textPrimary },
  orderItemNotes: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
  orderItemPrice: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  orderTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 4 },
  orderTotalLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  orderTotalValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.amber },
  footer: { backgroundColor: Colors.charcoal, borderTopWidth: 1, borderTopColor: Colors.warmDark, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  billValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.green },
  footerButtons: { flexDirection: "row", gap: 10 },
  primaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14 },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  statusChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface,
  },
  backBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.charcoal, borderRadius: 10 },
  backBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  statusModal: { backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20 },
  statusModalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textPrimary, marginBottom: 16 },
  statusOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, marginBottom: 6 },
  statusOptionText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  clientCard: {
    backgroundColor: Colors.charcoal,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  clientInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clientInput: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
});

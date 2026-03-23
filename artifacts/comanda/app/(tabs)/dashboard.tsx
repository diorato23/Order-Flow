import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import { triggerN8NWebhook } from "../../lib/n8n";
import { i18n } from "../../constants/i18n";
import { formatCurrency } from "../../lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/auth";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Stats {
  total_pedidos: number;
  receita_total: number;
  ticket_medio: number;
  pedidos_ativos: number;
  mesas_ocupadas: number;
  total_mesas: number;
  top_produtos: Array<{ produto_id: string; nome: string; quantidade_total: number; receita_total: number }>;
}

// ─── Query Supabase ──────────────────────────────────────────────────────────
async function fetchStats(restauranteId: string): Promise<Stats> {
  const { data, error } = await supabase.rpc("comanda_stats", {
    p_restaurante_id: restauranteId,
  });
  if (error) throw error;
  return data as Stats;
}

// ─── Componentes ──────────────────────────────────────────────────────────────
const StatCard = React.memo(({ label, value, icon, color, subtitle }: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap;
  color: string; subtitle?: string;
}) => {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );
});

const TopProductItem = React.memo(({ item, index }: { 
  item: Stats['top_produtos'][0]; 
  index: number 
}) => (
  <View style={styles.topItemRow}>
    <View style={styles.topItemRank}>
      <Text style={styles.rankNum}>{index + 1}</Text>
    </View>
    <View style={styles.topItemInfo}>
      <Text style={styles.topItemName} numberOfLines={1}>{item.nome}</Text>
      <Text style={styles.topItemCount}>{item.quantidade_total} pedido{item.quantidade_total !== 1 ? "s" : ""}</Text>
    </View>
    <Text style={styles.topItemRevenue}>{formatCurrency(Number(item.receita_total))}</Text>
  </View>
));

// ─── Tela Principal ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const qc = useQueryClient();

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: stats = null, isLoading, isError } = useQuery({
    queryKey: ["dashboard-stats", profile?.restaurante_id],
    queryFn: () => fetchStats(profile?.restaurante_id || ""),
    enabled: !!profile?.restaurante_id,
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  // ─── Realtime Sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.restaurante_id) return;

    // Escuta mudanças em pedidos para atualizar faturamento/vendas em tempo real
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_pedidos",
          filter: `restaurante_id=eq.${profile.restaurante_id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_mesas",
          filter: `restaurante_id=eq.${profile.restaurante_id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.restaurante_id, qc]);



  const handleFecharCaixa = async () => {
    if (!stats) return;
    setIsClosing(true);
    try {
      await triggerN8NWebhook("fechamento_caixa", {
        // Chaves originais (para compatibilidade com o que já está mapeado)
        receita_total: stats.receita_total,
        total_pedidos: stats.total_pedidos,
        ticket_medio: stats.ticket_medio,
        mesas_ocupadas: stats.mesas_ocupadas,
        total_mesas: stats.total_mesas,
        top_produtos: stats.top_produtos,
        
        // Chaves EXATAMENTE como aparecem na planilha do usuário (visto no n8n)
        // Isso facilita o mapeamento automático no n8n
        "faturamento bruto": stats.receita_total,
        "Total de pedidos": stats.total_pedidos,
        "Médio de bilhetes": stats.ticket_medio,
        "responsável": profile?.nome || "Desconhecido",
        "Status": "fechado",
        "Dados": new Date().toISOString(),

        // Extras para garantir
        faturamento: stats.receita_total,
        pedidos_total: stats.total_pedidos,
        ticket_medio_formantado: formatCurrency(stats.ticket_medio),
        data_fechamento: new Date().toLocaleDateString('pt-BR'),
        hora_fechamento: new Date().toLocaleTimeString('pt-BR'),
        responsavel: profile?.nome || "Desconhecido",
        restaurante_id: profile?.restaurante_id,
        
        // Resumo textual
        resumo_produtos: stats.top_produtos
          .map(p => `${p.nome} (${p.quantidade_total}x)`)
          .join(", ")
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCloseModal(false);
      Alert.alert(i18n.common.success, i18n.dashboard.closure.successMsg);
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(i18n.common.error, "Erro ao enviar relatório para o n8n.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!profile?.restaurante_id) return;
    setIsClosing(true);
    try {
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from("comanda_convites").insert({
        restaurante_id: profile.restaurante_id,
        codigo: codigo,
        usado: false,
      });
      
      if (error) throw error;
      
      setInviteCode(codigo);
      setShowInviteModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert("Erro ao gerar convite.");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{i18n.dashboard.title}</Text>
          <Text style={styles.subtitle}>{i18n.dashboard.subtitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => { 
              qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); 
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
            }}
            style={styles.iconButton}
          >
            <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", style: "destructive", onPress: () => signOut() }
              ]);
            }}
            style={[styles.iconButton, { marginLeft: 10 }]}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.red} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.amber} size="large" /></View>
      ) : !stats ? (
        <View style={styles.empty}>
          <Ionicons name="bar-chart-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{i18n.dashboard.empty}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content, 
            { paddingBottom: Platform.OS === "web" ? 134 : 140 } // Aumentando o espaço para caber o botão flutuante e a navbar
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsGrid}>
            <StatCard label={i18n.dashboard.totalRevenue} value={formatCurrency(stats.receita_total)} icon="cash-outline" color={Colors.green} />
            <StatCard label={i18n.dashboard.avgTicket} value={formatCurrency(stats.ticket_medio)} icon="trending-up-outline" color={Colors.amber} />
            <StatCard label={i18n.dashboard.orders} value={String(stats.total_pedidos)} icon="receipt-outline" color={Colors.blue} subtitle={i18n.dashboard.ordersActive(stats.pedidos_ativos)} />
            <StatCard label={i18n.dashboard.tables} value={`${stats.mesas_ocupadas}/${stats.total_mesas}`} icon="grid-outline" color={Colors.orange} subtitle={i18n.dashboard.tablesOccupied} />
          </View>

          {profile?.funcao === "admin" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Equipe</Text>
              <Text style={[styles.statSubtitle, { marginBottom: 16 }]}>Gere convites para seus funcionários entrarem no sistema.</Text>
              <TouchableOpacity onPress={handleGenerateInvite} style={styles.inviteButton}>
                <Ionicons name="people" size={20} color={Colors.espresso} />
                <Text style={styles.inviteButtonText}>Gerar Código de Convite</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{i18n.dashboard.topProducts}</Text>
            {!stats.top_produtos || stats.top_produtos.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>{i18n.dashboard.noData}</Text>
              </View>
            ) : (
              stats.top_produtos.map((item, index) => (
                <TopProductItem key={item.produto_id} item={item} index={index} />
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{i18n.dashboard.occupancyTitle}</Text>
            <View style={styles.occupancyBar}>
              <View
                style={[
                  styles.occupancyFill,
                  { width: `${stats.total_mesas > 0 ? (stats.mesas_ocupadas / stats.total_mesas) * 100 : 0}%` },
                ]}
              />
            </View>
            <View style={styles.occupancyLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.amber }]} />
                <Text style={styles.legendText}>{i18n.dashboard.legendOccupied(stats.mesas_ocupadas)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.surface }]} />
                <Text style={styles.legendText}>{i18n.dashboard.legendFree(stats.total_mesas - stats.mesas_ocupadas)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

       {!isLoading && stats && (
         <View style={[
           styles.bottomButtonContainer, 
           // Ajustado `bottom: 80` (altura comum de tabBars) ou mais para evitar colisão com a barra de navegação
           { bottom: Platform.OS === "web" ? 34 : 95 } 
         ]}>
            <TouchableOpacity
               onPress={() => {
                 Alert.alert(
                   i18n.dashboard.closure.alertTitle,
                   i18n.dashboard.closure.alertMsg,
                   [
                     { text: i18n.common.cancel, style: "cancel" },
                     { 
                       text: i18n.common.confirm, 
                       onPress: () => {
                         setShowCloseModal(true); 
                         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                       } 
                     }
                   ]
                 );
               }}
               style={styles.closeCaixaButton}
            >
               <Ionicons name="lock-closed-outline" size={20} color={Colors.espresso} />
               <Text style={styles.closeCaixaButtonText}>Encerrar Caixa do Dia</Text>
            </TouchableOpacity>
         </View>
       )}

      {/* Modal de Confirmação de Fechamento */}
      <Modal visible={showCloseModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !isClosing && setShowCloseModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{i18n.dashboard.closure.modalTitle}</Text>
            <Text style={styles.modalSubtitle}>{i18n.dashboard.closure.modalSubtitle}</Text>
            
            <View style={styles.reportContainer}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportHeaderText}>RESUMO DE VENDAS</Text>
                <Text style={styles.reportDate}>{new Date().toLocaleDateString()}</Text>
              </View>

              <View style={styles.reportDivider} />

              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Total de Pedidos:</Text>
                <Text style={styles.modalStatValue}>{stats?.total_pedidos || 0}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Receita do Dia:</Text>
                <Text style={[styles.modalStatValue, { color: Colors.green }]}>
                  {stats ? formatCurrency(stats.receita_total) : "R$ 0,00"}
                </Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Ticket Médio:</Text>
                <Text style={styles.modalStatValue}>
                  {stats ? formatCurrency(stats.ticket_medio) : "R$ 0,00"}
                </Text>
              </View>

              <View style={styles.reportDivider} />
              
              <Text style={styles.reportSectionTitle}>Top Produtos:</Text>
              {stats?.top_produtos.slice(0, 3).map((item, idx) => (
                <View key={item.produto_id} style={styles.reportItemRow}>
                  <Text style={styles.reportItemText}>{item.nome}</Text>
                  <Text style={styles.reportItemValue}>{item.quantidade_total}x</Text>
                </View>
              ))}

              <View style={styles.reportFooter}>
                <Text style={styles.reportFooterText}>Responsável: {profile?.nome}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, isClosing && { opacity: 0.7 }]}
              onPress={handleFecharCaixa}
              disabled={isClosing}
            >
              {isClosing ? <ActivityIndicator color={Colors.espresso} /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.espresso} />
                  <Text style={styles.confirmButtonText}>{i18n.dashboard.closure.confirmBtn}</Text>
                </>
              )}
            </TouchableOpacity>
            
             <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCloseModal(false)}
              disabled={isClosing}
            >
              <Text style={styles.cancelButtonText}>{i18n.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Convite */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInviteModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Convite Gerado</Text>
            <Text style={styles.modalSubtitle}>
              Compartilhe o código abaixo com o seu funcionário. Ele deve utilizá-lo na tela inicial do app para se registrar.
            </Text>
            
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText} selectable={true}>{inviteCode}</Text>
            </View>

            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={() => {
                const msg = `Olá! Segue o seu código de acesso à nossa equipe no app Comanda:\n\n*${inviteCode}*\n\nBasta inseri-lo ao selecionar a opção Empregado na tela inicial de login!`;
                Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => {
                  Alert.alert("Erro", "Ocorreu um erro ao tentar abrir o WhatsApp.");
                });
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.whatsappButtonText}>Compartilhar no WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowInviteModal(false)}
            >
              <Text style={styles.cancelButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: { width: "47%", backgroundColor: Colors.charcoal, borderRadius: 16, padding: 16, borderTopWidth: 3, gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary },
  statSubtitle: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  section: { backgroundColor: Colors.charcoal, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textPrimary, marginBottom: 14 },
  topItemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.warmDark, gap: 12 },
  topItemRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.amber + "22", alignItems: "center", justifyContent: "center" },
  rankNum: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.amber },
  topItemInfo: { flex: 1 },
  topItemName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textPrimary },
  topItemCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  topItemRevenue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.green },
  occupancyBar: { height: 12, borderRadius: 6, backgroundColor: Colors.warmDark, overflow: "hidden", marginBottom: 12 },
  occupancyFill: { height: "100%", borderRadius: 6, backgroundColor: Colors.amber },
  occupancyLegend: { flexDirection: "row", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  emptySection: { paddingVertical: 20, alignItems: "center" },
  emptySectionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textMuted },
  bottomButtonContainer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, backgroundColor: 'transparent' },
  closeCaixaButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.amber, paddingVertical: 16, borderRadius: 16, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  closeCaixaButtonText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.espresso },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  modalContainer: { backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, marginBottom: 8, textAlign: "center" },
  modalSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginBottom: 24 },
  modalStatsBox: { backgroundColor: Colors.warmDark, padding: 16, borderRadius: 16, marginBottom: 24, gap: 12 },
  modalStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalStatLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  modalStatValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.textPrimary },
  confirmButton: { flexDirection: "row", backgroundColor: Colors.amber, paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  confirmButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.espresso },
  cancelButton: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  inviteButton: { flexDirection: "row", backgroundColor: Colors.amber, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  inviteButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
  inviteCodeBox: { backgroundColor: Colors.surface, padding: 20, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 24, borderWidth: 2, borderColor: Colors.warmDark, borderStyle: "dashed" },
  inviteCodeText: { fontFamily: "Inter_700Bold", fontSize: 32, color: Colors.amber, letterSpacing: 4 },
  whatsappButton: { flexDirection: "row", backgroundColor: "#25D366", paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  whatsappButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  reportContainer: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.warmDark, borderStyle: "dashed" },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  reportHeaderText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.textMuted, letterSpacing: 1 },
  reportDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  reportDivider: { height: 1, backgroundColor: Colors.warmDark, marginVertical: 12 },
  reportSectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  reportItemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  reportItemText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textPrimary },
  reportItemValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  reportFooter: { marginTop: 16, alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.warmDark, paddingTop: 12 },
  reportFooterText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
});

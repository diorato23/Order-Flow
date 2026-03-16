import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  id: number;
  menuItemName: string;
  quantity: number;
  notes?: string;
  menuItemPrice: number;
  subtotal: number;
}

interface Order {
  id: number;
  tableId: number;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
}

interface TableData {
  id: number;
  number: number;
  capacity: number;
  status: TableStatus;
  guestName?: string;
}

async function fetchTable(id: string): Promise<TableData> {
  const res = await fetch(`${BASE_URL}/api/tables/${id}`);
  return res.json();
}

async function fetchTableOrders(id: string): Promise<Order[]> {
  const res = await fetch(`${BASE_URL}/api/tables/${id}/orders`);
  return res.json();
}

async function updateTableStatus(id: number, status: TableStatus) {
  const res = await fetch(`${BASE_URL}/api/tables/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

export default function TableDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showStatusModal, setShowStatusModal] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: table, isLoading: tableLoading } = useQuery<TableData>({
    queryKey: ["table", id],
    queryFn: () => fetchTable(id!),
    enabled: !!id,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["table-orders", id],
    queryFn: () => fetchTableOrders(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: TableStatus }) => updateTableStatus(Number(id), status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table", id] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      setShowStatusModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const totalBill = activeOrders.reduce((sum, o) => sum + Number(o.total), 0);

  const statusOptions: Array<{ key: TableStatus; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: "available", label: "Disponível", icon: "checkmark-circle-outline" },
    { key: "occupied", label: "Ocupada", icon: "people-outline" },
    { key: "reserved", label: "Reservada", icon: "calendar-outline" },
    { key: "cleaning", label: "Limpeza", icon: "sparkles-outline" },
  ];

  if (tableLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator color={Colors.amber} size="large" />
      </View>
    );
  }

  if (!table) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPadding }]}>
        <Text style={styles.errorText}>Mesa não encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = Colors.statusColors[table.status];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            router.back();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Mesa {table.number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {Colors.statusLabels[table.status]}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowStatusModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.editButton}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>Capacidade {table.capacity}</Text>
        </View>
        {table.guestName ? (
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>{table.guestName}</Text>
          </View>
        ) : null}
        <View style={styles.infoItem}>
          <Ionicons name="receipt-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{activeOrders.length} pedido{activeOrders.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ordersLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.amber} />
          </View>
        ) : activeOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum pedido ativo</Text>
            <Text style={styles.emptySubtitle}>Adicione um pedido para esta mesa</Text>
          </View>
        ) : (
          activeOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View style={styles.orderCardLeft}>
                  <Text style={styles.orderId}>Pedido #{order.id}</Text>
                  <Text style={styles.orderTime}>{timeAgo(order.createdAt)}</Text>
                </View>
                <View style={[styles.orderStatusPill, { backgroundColor: Colors.statusColors[order.status] + "22" }]}>
                  <Text style={[styles.orderStatusText, { color: Colors.statusColors[order.status] }]}>
                    {Colors.statusLabels[order.status]}
                  </Text>
                </View>
              </View>

              {order.items.map((item) => (
                <View key={item.id} style={styles.orderItemRow}>
                  <Text style={styles.orderItemQty}>{item.quantity}x</Text>
                  <View style={styles.orderItemInfo}>
                    <Text style={styles.orderItemName}>{item.menuItemName}</Text>
                    {item.notes ? <Text style={styles.orderItemNotes}>{item.notes}</Text> : null}
                  </View>
                  <Text style={styles.orderItemPrice}>
                    R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
                  </Text>
                </View>
              ))}

              <View style={styles.orderTotal}>
                <Text style={styles.orderTotalLabel}>Total do pedido</Text>
                <Text style={styles.orderTotalValue}>
                  R$ {Number(order.total).toFixed(2).replace(".", ",")}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
        {totalBill > 0 ? (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Total da Conta</Text>
            <Text style={styles.billValue}>
              R$ {totalBill.toFixed(2).replace(".", ",")}
            </Text>
          </View>
        ) : null}
        <View style={styles.footerButtons}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/order/new", params: { tableId: table.id, tableNumber: table.number } });
            }}
            style={styles.primaryButton}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.espresso} />
            <Text style={styles.primaryButtonText}>Novo Pedido</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showStatusModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.statusModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.statusModalTitle}>Alterar Status</Text>
            {statusOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => statusMutation.mutate({ status: opt.key })}
                style={[
                  styles.statusOption,
                  table.status === opt.key && { backgroundColor: Colors.statusColors[opt.key] + "22" },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={table.status === opt.key ? Colors.statusColors[opt.key] : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    table.status === opt.key && { color: Colors.statusColors[opt.key] },
                  ]}
                >
                  {opt.label}
                </Text>
                {table.status === opt.key ? (
                  <Ionicons name="checkmark" size={18} color={Colors.statusColors[opt.key]} style={{ marginLeft: "auto" }} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, gap: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.textPrimary, letterSpacing: -0.5 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  editButton: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center",
  },
  infoBar: {
    flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingBottom: 16,
    flexWrap: "wrap",
  },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  emptyOrders: {
    alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.textSecondary },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textMuted },
  orderCard: {
    backgroundColor: Colors.charcoal, borderRadius: 16, padding: 16, marginBottom: 4,
  },
  orderCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  orderCardLeft: { gap: 2 },
  orderId: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  orderTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  orderStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  orderStatusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  orderItemRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.warmDark, gap: 10,
  },
  orderItemQty: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.amber, width: 24 },
  orderItemInfo: { flex: 1 },
  orderItemName: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textPrimary },
  orderItemNotes: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
  orderItemPrice: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  orderTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, marginTop: 4,
  },
  orderTotalLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  orderTotalValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.amber },
  footer: {
    backgroundColor: Colors.charcoal, borderTopWidth: 1, borderTopColor: Colors.warmDark,
    paddingHorizontal: 16, paddingTop: 12, gap: 10,
  },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  billValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.green },
  footerButtons: { flexDirection: "row", gap: 10 },
  primaryButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14,
  },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  backBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.charcoal, borderRadius: 10 },
  backBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  statusModal: {
    backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20,
  },
  statusModalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textPrimary, marginBottom: 16 },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 6,
  },
  statusOptionText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
});

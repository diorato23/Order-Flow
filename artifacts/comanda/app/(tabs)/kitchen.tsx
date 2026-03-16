import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  id: number;
  menuItemName: string;
  quantity: number;
  notes?: string;
  subtotal: number;
}

interface Order {
  id: number;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
}

async function fetchKitchenOrders() {
  const res = await fetch(`${BASE_URL}/api/orders`);
  const all: Order[] = await res.json();
  return all.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
}

async function updateOrderStatus(id: number, status: OrderStatus) {
  const res = await fetch(`${BASE_URL}/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: number, status: OrderStatus) => void }) {
  const statusColor = Colors.statusColors[order.status];
  const statusLabel = Colors.statusLabels[order.status];

  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pending: "preparing",
    preparing: "ready",
    ready: "delivered",
    delivered: null,
    cancelled: null,
  };

  const nextStatusLabel: Record<OrderStatus, string> = {
    pending: "Iniciar",
    preparing: "Pronto",
    ready: "Entregue",
    delivered: "",
    cancelled: "",
  };

  const next = nextStatus[order.status];

  return (
    <View style={[styles.orderCard, { borderLeftColor: statusColor }]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Text style={styles.tableNum}>Mesa {order.tableNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.orderHeaderRight}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.timeAgo}>{timeAgo(order.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.itemsList}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemQtyBadge}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
            </View>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.menuItemName}</Text>
              {item.notes ? (
                <Text style={styles.itemNotes}>{item.notes}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {order.notes ? (
        <View style={styles.orderNotes}>
          <Ionicons name="chatbubble-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.orderNotesText}>{order.notes}</Text>
        </View>
      ) : null}

      {next ? (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStatusChange(order.id, next);
          }}
          style={[styles.actionButton, { backgroundColor: statusColor }]}
        >
          <Ionicons
            name={next === "preparing" ? "flame" : next === "ready" ? "checkmark-circle" : "checkmark-done-circle"}
            size={16}
            color={Colors.espresso}
          />
          <Text style={styles.actionButtonText}>{nextStatusLabel[order.status]}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function KitchenScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["kitchen-orders"],
    queryFn: fetchKitchenOrders,
    refetchInterval: 8000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
    setRefreshing(false);
  }, [qc]);

  const filtered = filterStatus === "all" ? orders : orders.filter((o) => o.status === filterStatus);

  const counts = {
    pending: orders.filter((o) => o.status === "pending").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
  };

  const statusFilters: Array<{ key: OrderStatus | "all"; label: string; count?: number }> = [
    { key: "all", label: "Todos", count: orders.length },
    { key: "pending", label: "Pendentes", count: counts.pending },
    { key: "preparing", label: "Preparando", count: counts.preparing },
    { key: "ready", label: "Prontos", count: counts.ready },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cozinha</Text>
          <Text style={styles.subtitle}>{orders.length} pedidos ativos</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Ao vivo</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {statusFilters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => {
              setFilterStatus(f.key);
              Haptics.selectionAsync();
            }}
            style={[styles.filterChip, filterStatus === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filterStatus === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
            {f.count !== undefined && f.count > 0 ? (
              <View style={[styles.filterBadge, filterStatus === f.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filterStatus === f.key && styles.filterBadgeTextActive]}>
                  {f.count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.amber} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="flame-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Cozinha tranquila</Text>
          <Text style={styles.emptySubtitle}>Nenhum pedido ativo no momento</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 134 : 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.amber}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.espresso,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.green,
  },
  liveText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.green,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.warmDark,
    borderWidth: 1,
    borderColor: Colors.surface,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.espresso,
  },
  filterBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeActive: {
    backgroundColor: Colors.espresso + "44",
  },
  filterBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
  },
  filterBadgeTextActive: {
    color: Colors.espresso,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 4,
  },
  orderCard: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tableNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  timeAgo: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  itemsList: {
    gap: 8,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  itemQtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.amber + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  itemQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.amber,
  },
  itemDetails: {
    flex: 1,
    paddingTop: 5,
  },
  itemName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  itemNotes: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
  },
  orderNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: Colors.warmDark,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  orderNotesText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  actionButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.espresso,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textMuted,
  },
});

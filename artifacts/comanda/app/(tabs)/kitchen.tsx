import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { i18n } from "../../constants/i18n";
import { triggerN8NWebhook } from "../../lib/n8n";

import supabase from "../../lib/supabase/client";
import { useAuth } from "../../context/auth";
import OrderSkeleton from "../../components/OrderSkeleton";

type OrderStatus = "pendente" | "preparando" | "pronto" | "entregue" | "cancelado";

interface OrderItem {
  id: number;
  menuItemName: string;
  quantity: number;
  notes?: string;
  subtotal: number;
}

interface Order {
  id: string;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
  preparandoEm?: string;
  prontoEm?: string;
  garcomId: string | null;
  garcomNome?: string;
}

async function fetchKitchenOrders(restauranteId: string) {
  const { data, error } = await supabase
    .from("comanda_pedidos")
    .select("*, comanda_mesas(numero), comanda_usuarios(nome), comanda_itens_pedido(*)")
    .eq("restaurante_id", restauranteId)
    .neq("status", "entregue")
    .neq("status", "cancelado")
    .order("criado_em", { ascending: true });

  if (error) throw error;

  return (data || []).map((o: any) => ({
    id: o.id,
    tableNumber: o.comanda_mesas?.numero || 0,
    status: o.status as OrderStatus,
    total: o.total,
    notes: o.observacoes,
    createdAt: o.criado_em,
    preparandoEm: o.preparando_em,
    prontoEm: o.pronto_em,
    garcomId: o.garcom_id,
    garcomNome: o.comanda_usuarios?.nome || "Garçom",
    items: (o.comanda_itens_pedido || []).map((i: any) => ({
      id: i.id,
      menuItemName: i.nome_produto,
      quantity: i.quantidade,
      notes: i.observacoes,
      subtotal: i.subtotal,
    })),
  }));
}

async function updateOrderStatus(id: string, status: OrderStatus) {
  const updateData: Record<string, string> = { status: status };
  
  if (status === "preparando") {
    updateData.preparando_em = new Date().toISOString();
  } else if (status === "pronto") {
    updateData.pronto_em = new Date().toISOString();
  }

  const { error } = await supabase
    .from("comanda_pedidos")
    .update(updateData as Record<string, string>)
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

const OrderCard = React.memo(function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, status: OrderStatus) => void }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (order.status === "preparando") {
      const timer = setInterval(() => setNow(Date.now()), 10000);
      return () => clearInterval(timer);
    }
  }, [order.status]);

  const statusColor = Colors.statusColors[order.status];
  
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pendente: "preparando",
    preparando: "pronto",
    pronto: "entregue",
    entregue: null,
    cancelado: null,
  };

  const nextStatusLabel: Record<OrderStatus, string> = {
    pendente: i18n.kitchen.actions.start,
    preparando: i18n.kitchen.actions.ready,
    pronto: i18n.kitchen.actions.delivered,
    entregue: "",
    cancelado: "",
  };

  const next = nextStatus[order.status];

  return (
    <View style={[styles.orderCard, { borderLeftColor: statusColor }]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Text style={styles.tableNum}>{i18n.tables.tableName(order.tableNumber)}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{i18n.common.status[order.status]}</Text>
          </View>
        </View>
        <View style={styles.orderHeaderRight}>
          <View style={styles.garcomBadge}>
            <Ionicons name="person-outline" size={10} color={Colors.textMuted} />
            <Text style={styles.garcomName}>{order.garcomNome}</Text>
          </View>
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

      {order.status === "preparando" && order.preparandoEm ? (
        <View style={[styles.prepTimeSummary, { backgroundColor: Colors.amber + "22" }]}>
          <Ionicons name="timer-outline" size={12} color={Colors.amber} />
          <Text style={[styles.prepTimeSummaryText, { color: Colors.amber }]}>
            Preparando há: {Math.floor((now - new Date(order.preparandoEm).getTime()) / 60000)} min
          </Text>
        </View>
      ) : null}

      {order.status === "pronto" && order.preparandoEm && order.prontoEm ? (
        <View style={styles.prepTimeSummary}>
          <Ionicons name="timer-outline" size={12} color={Colors.green} />
          <Text style={styles.prepTimeSummaryText}>
            Tempo de preparo: {Math.floor((new Date(order.prontoEm).getTime() - new Date(order.preparandoEm).getTime()) / 60000)} min
          </Text>
        </View>
      ) : null}

      {next ? (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStatusChange(order.id, next);
          }}
          style={[styles.actionButton, { backgroundColor: statusColor }]}
          accessibilityRole="button"
          accessibilityLabel={`${nextStatusLabel[order.status]} - ${i18n.tables.tableName(order.tableNumber)}`}
        >
          <Ionicons
            name={next === "preparando" ? "flame" : next === "pronto" ? "checkmark-circle" : "checkmark-done-circle"}
            size={16}
            color={Colors.espresso}
          />
          <Text style={styles.actionButtonText}>{nextStatusLabel[order.status]}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default function KitchenScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { profile } = useAuth();
  const { data: orders = [] as Order[], isLoading } = useQuery<Order[]>({
    queryKey: ["kitchen-orders", profile?.restaurante_id],
    queryFn: () => fetchKitchenOrders(profile?.restaurante_id || ""),
    enabled: !!profile?.restaurante_id,
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
  });

  // ─── Realtime Sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.restaurante_id) return;

    if (__DEV__) console.log("[DEBUG] Ativando Realtime Cozinha para:", profile.restaurante_id);

    const channel = supabase
      .channel("kitchen-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_pedidos",
          filter: `restaurante_id=eq.${profile.restaurante_id}`,
        },
        (payload) => {
          if (__DEV__) console.log("[DEBUG] Mudança detectada na cozinha:", payload.eventType);
          qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.restaurante_id, qc]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Disparar notificação se o pedido estiver PRONTO (Listo)
      if (variables.status === "pronto") {
        const order = orders.find(o => o.id === variables.id);
        triggerN8NWebhook("pedido_pronto", {
          pedido_id: variables.id,
          mesa_numero: order?.tableNumber,
          garcom_id: order?.garcomId,
          restaurante_id: profile?.restaurante_id,
          titulo: i18n.common.status.pronto,
          mensagem: `El pedido de la Mesa ${order?.tableNumber} está listo!`,
        });
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
    setRefreshing(false);
  }, [qc]);

  const counts = useMemo(() => ({
    pendente: orders.filter((o) => o.status === "pendente").length,
    preparando: orders.filter((o) => o.status === "preparando").length,
    pronto: orders.filter((o) => o.status === "pronto").length,
  }), [orders]);

  const filtered = useMemo(
    () => filterStatus === "all" ? orders : orders.filter((o) => o.status === filterStatus),
    [orders, filterStatus]
  );

  const renderOrderItem = useCallback(({ item }: { item: Order }) => (
    <OrderCard
      order={item}
      onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
    />
  ), [statusMutation]);

  const statusFilters: Array<{ key: OrderStatus | "all"; label: string; count?: number }> = [
    { key: "all", label: i18n.kitchen.filterAll, count: orders.length },
    { key: "pendente", label: i18n.kitchen.filterPending, count: counts.pendente },
    { key: "preparando", label: i18n.kitchen.filterPreparing, count: counts.preparando },
    { key: "pronto", label: i18n.kitchen.filterReady, count: counts.pronto },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{i18n.kitchen.title}</Text>
          <Text style={styles.subtitle}>{i18n.kitchen.subtitle(orders.length)}</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{i18n.kitchen.live}</Text>
        </View>
      </View>

      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {statusFilters.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => {
                setFilterStatus(f.key);
                Haptics.selectionAsync();
              }}
              style={[styles.filterChip, filterStatus === f.key && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`${f.label} ${f.count ?? 0}`}
              accessibilityState={{ selected: filterStatus === f.key }}
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
        </ScrollView>
      </View>

      {isLoading ? (
        <OrderSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="flame-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{i18n.kitchen.empty}</Text>
          <Text style={styles.emptySubtitle}>{i18n.kitchen.emptySubtitle}</Text>
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
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={5}
          renderItem={renderOrderItem}
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
  filterScroll: { marginBottom: 16 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25,
    backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface,
    justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6
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
  garcomBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 8,
  },
  garcomName: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
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
    color: Colors.textSecondary,
    flex: 1,
  },
  prepTimeSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warmDark,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  prepTimeSummaryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.green,
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

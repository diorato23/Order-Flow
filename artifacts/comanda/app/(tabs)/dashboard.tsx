import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  activeOrders: number;
  occupiedTables: number;
  totalTables: number;
  topItems: Array<{ menuItemId: number; name: string; count: number; revenue: number }>;
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE_URL}/api/stats`);
  return res.json();
}

function StatCard({ label, value, icon, color, subtitle }: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
}) {
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
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Relatórios</Text>
          <Text style={styles.subtitle}>Visão geral do dia</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            refetch();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.amber} size="large" />
        </View>
      ) : !stats ? (
        <View style={styles.empty}>
          <Ionicons name="bar-chart-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Sem dados disponíveis</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 134 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsGrid}>
            <StatCard
              label="Receita Total"
              value={formatCurrency(stats.totalRevenue)}
              icon="cash-outline"
              color={Colors.green}
            />
            <StatCard
              label="Ticket Médio"
              value={formatCurrency(stats.averageTicket)}
              icon="trending-up-outline"
              color={Colors.amber}
            />
            <StatCard
              label="Pedidos"
              value={String(stats.totalOrders)}
              icon="receipt-outline"
              color={Colors.blue}
              subtitle={`${stats.activeOrders} ativos`}
            />
            <StatCard
              label="Mesas"
              value={`${stats.occupiedTables}/${stats.totalTables}`}
              icon="grid-outline"
              color={Colors.orange}
              subtitle="ocupadas"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mais Vendidos</Text>
            {stats.topItems.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>Nenhum pedido registrado ainda</Text>
              </View>
            ) : (
              stats.topItems.map((item, index) => (
                <View key={item.menuItemId} style={styles.topItemRow}>
                  <View style={styles.topItemRank}>
                    <Text style={styles.rankNum}>{index + 1}</Text>
                  </View>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.topItemCount}>{item.count} pedido{item.count !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={styles.topItemRevenue}>{formatCurrency(item.revenue)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ocupação</Text>
            <View style={styles.occupancyBar}>
              <View
                style={[
                  styles.occupancyFill,
                  {
                    width: `${stats.totalTables > 0 ? (stats.occupiedTables / stats.totalTables) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.occupancyLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.amber }]} />
                <Text style={styles.legendText}>{stats.occupiedTables} Ocupadas</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.surface }]} />
                <Text style={styles.legendText}>{stats.totalTables - stats.occupiedTables} Livres</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  refreshButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: {
    width: "47%",
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    borderTopWidth: 3,
    gap: 6,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary },
  statSubtitle: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textPrimary, marginBottom: 14 },
  topItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warmDark,
    gap: 12,
  },
  topItemRank: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.amber + "22", alignItems: "center", justifyContent: "center",
  },
  rankNum: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.amber },
  topItemInfo: { flex: 1 },
  topItemName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textPrimary },
  topItemCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  topItemRevenue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.green },
  occupancyBar: {
    height: 12, borderRadius: 6,
    backgroundColor: Colors.warmDark, overflow: "hidden", marginBottom: 12,
  },
  occupancyFill: {
    height: "100%", borderRadius: 6,
    backgroundColor: Colors.amber,
  },
  occupancyLegend: { flexDirection: "row", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  emptySection: { paddingVertical: 20, alignItems: "center" },
  emptySectionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textMuted },
});

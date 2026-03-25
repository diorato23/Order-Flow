import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import type { Mesa, MesaStatus } from "../../lib/supabase/types";
import { i18n } from "../../constants/i18n";

import { useAuth } from "../../context/auth";
import TableSkeleton from "../../components/TableSkeleton";

// ─── Queries Supabase ────────────────────────────────────────────────────────
async function fetchMesas(restauranteId: string): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("comanda_mesas")
    .select("*")
    .eq("restaurante_id", restauranteId)
    .order("numero", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function criarMesa(restauranteId: string, numero: number, capacidade: number) {
  const { data, error } = await supabase
    .from("comanda_mesas")
    .insert({ restaurante_id: restauranteId, numero, capacidade })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function atualizarMesa(id: string, data: { numero: number; capacidade: number }) {
  const { error } = await supabase
    .from("comanda_mesas")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}

async function excluirMesa(id: string) {
  const { error } = await supabase
    .from("comanda_mesas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

interface ReadyOrder {
  id: string;
  criado_em: string;
  status: string;
  restaurante_id: string;
  comanda_mesas: {
    numero: number;
  } | null;
}

async function fetchReadyOrders(restauranteId: string): Promise<ReadyOrder[]> {
  const { data, error } = await supabase
    .from("comanda_pedidos")
    .select("id, criado_em, status, restaurante_id, comanda_mesas(numero)")
    .eq("restaurante_id", restauranteId)
    .eq("status", "pronto")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ReadyOrder[];
}

async function markOrderDelivered(id: string) {
  const { error } = await supabase
    .from("comanda_pedidos")
    .update({ status: "entregue" })
    .eq("id", id);
  if (error) throw error;
}

// ─── Componente de Card ──────────────────────────────────────────────────────
const TableCard = React.memo(({ mesa, onPress, onEdit, index }: { mesa: Mesa; onPress: () => void; onEdit: () => void; index: number }) => {
  const color = (Colors.statusColors as Record<string, string>)[mesa.status] ?? Colors.textMuted;
  const label = (Colors.statusLabels as Record<string, string>)[mesa.status] ?? mesa.status;

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition}
      style={styles.tableCard}
    >
      <TouchableOpacity onPress={onPress} onLongPress={onEdit} activeOpacity={0.75} style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${i18n.tables.tableName(mesa.numero)} - ${label}`}
      >
        <View style={[styles.tableCardInner, { borderColor: color + "33" }]}>
          <View style={styles.tableCardHeader}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <TouchableOpacity onPress={onEdit} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.tableNumber}>{i18n.tables.tableName(mesa.numero)}</Text>
          <View style={styles.tableCapacityRow}>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.tableCapacity}>{mesa.capacidade}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
            <Text style={[styles.statusText, { color }]}>{label}</Text>
          </View>
          {mesa.nome_cliente ? (
            <Text style={styles.guestName} numberOfLines={1}>{mesa.nome_cliente}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function TablesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<MesaStatus | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [refreshing, setRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const { profile } = useAuth();

  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ["tables", profile?.restaurante_id],
    queryFn: () => fetchMesas(profile?.restaurante_id || ""),
    enabled: !!profile?.restaurante_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { numero: number; capacidade: number }) => {
      const restId = profile?.restaurante_id;
      if (__DEV__) console.log("Tentando salvar mesa. Restaurante ID:", restId);

      if (editingMesa) {
        return atualizarMesa(editingMesa.id, payload);
      }

      if (!restId || restId === "") {
        throw new Error("ID do restaurante está vazio ou inválido.");
      }

      return criarMesa(restId, payload.numero, payload.capacidade);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      setShowAddModal(false);
      setEditingMesa(null);
      setNewTableNumber("");
      setNewTableCapacity("4");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      console.error(err);
      Alert.alert(i18n.common.error, "Não foi possível salvar a mesa.");
    }
  });

  const { data: readyOrders = [], refetch: refetchNotifications } = useQuery({
    queryKey: ["ready-orders", profile?.restaurante_id],
    queryFn: () => fetchReadyOrders(profile?.restaurante_id || ""),
    enabled: !!profile?.restaurante_id,
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => markOrderDelivered(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ready-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => excluirMesa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      setShowAddModal(false);
      setEditingMesa(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      console.error(err);
      Alert.alert(i18n.common.error, "Não foi possível excluir a mesa.");
    }
  });

  // Realtime: atualizar quando mesa mudar
  useEffect(() => {
    if (!profile?.restaurante_id) return;
    const channel = supabase
      .channel("mesas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comanda_mesas", filter: `restaurante_id=eq.${profile.restaurante_id}` },
        () => qc.invalidateQueries({ queryKey: ["tables"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comanda_pedidos", filter: `restaurante_id=eq.${profile.restaurante_id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["ready-orders"] });
          qc.invalidateQueries({ queryKey: ["tables"] });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, profile?.restaurante_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["tables"] });
    setRefreshing(false);
  }, [qc]);

  const handleAdd = async () => {
    if (__DEV__) console.log("handleAdd acionado. Perfil atual:", profile);
    
    if (!profile?.restaurante_id || profile.restaurante_id.length < 10) {
      Alert.alert("Erro", "Seu restaurante ainda não foi carregado corretamente. Por favor, reinicie o app.");
      return;
    }

    if (!newTableNumber || !newTableCapacity) {
      Alert.alert("Atenção", "Preencha o número e a capacidade da mesa.");
      return;
    }
    
    saveMutation.mutate({
      numero: Number(newTableNumber),
      capacidade: Number(newTableCapacity),
    });
  };

  const handleDelete = async () => {
    if (!editingMesa) return;
    deleteMutation.mutate(editingMesa.id);
  };

  const handleEditPress = useCallback((m: Mesa) => {
    setEditingMesa(m);
    setNewTableNumber(String(m.numero));
    setNewTableCapacity(String(m.capacidade));
    setShowAddModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? mesas : mesas.filter((t) => t.status === filter),
    [mesas, filter]
  );

  const counts = useMemo(() => ({
    all: mesas.length,
    disponivel: mesas.filter((t) => t.status === "disponivel").length,
    ocupada: mesas.filter((t) => t.status === "ocupada").length,
    reservada: mesas.filter((t) => t.status === "reservada").length,
  }), [mesas]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filters: Array<{ key: MesaStatus | "all"; label: string; count?: number }> = [
    { key: "all", label: i18n.common.all, count: counts.all },
    { key: "disponivel", label: i18n.tables.available, count: counts.disponivel },
    { key: "ocupada", label: i18n.tables.occupied, count: counts.ocupada },
    { key: "reservada", label: i18n.tables.reserved, count: counts.reservada },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{i18n.tables.title}</Text>
          <Text style={styles.subtitle}>{i18n.tables.subtitle(mesas.length, counts.ocupada)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowNotifications(true);
            }}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            {readyOrders.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{readyOrders.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddModal(true);
            }}
            style={styles.addButton}
          >
            <Ionicons name="add" size={22} color={Colors.espresso} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => {
              setFilter(f.key);
              Haptics.selectionAsync();
            }}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            accessibilityRole="button"
            accessibilityLabel={`${f.label} ${f.count ?? 0}`}
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
            {f.count !== undefined && f.count > 0 ? (
              <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === f.key && styles.filterBadgeTextActive]}>
                  {f.count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <TableSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="restaurant-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{i18n.tables.empty}</Text>
          <TouchableOpacity onPress={() => { setEditingMesa(null); setShowAddModal(true); }} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>{i18n.tables.addFirst}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomPadding + 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.amber} />
          }
          renderItem={useCallback(({ item, index }: { item: Mesa; index: number }) => (
            <TableCard
              mesa={item}
              index={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/table/${item.id}`);
              }}
              onEdit={() => handleEditPress(item)}
            />
          ), [handleEditPress])}
        />
      )}

      <Modal visible={showNotifications} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            onPress={() => setShowNotifications(false)} 
            activeOpacity={1} 
          />
          <Animated.View 
            entering={FadeInDown}
            style={[styles.modalContainer, { maxHeight: "70%" }]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{i18n.alerts.title}</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {readyOrders.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.surface} />
                <Text style={styles.emptyNotificationsText}>{i18n.alerts.empty}</Text>
              </View>
            ) : (
              <FlatList
                data={readyOrders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: ReadyOrder }) => (
                  <View style={styles.notificationItem}>
                    <View style={styles.notificationInfo}>
                      <Text style={styles.notificationMesa}>
                        {i18n.tables.tableName(item.comanda_mesas?.numero || 0)}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {new Date(item.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.deliverButton}
                      onPress={() => {
                        deliverMutation.mutate(item.id);
                        if (readyOrders.length === 1) setShowNotifications(false);
                      }}
                    >
                      <Text style={styles.deliverButtonText}>{i18n.alerts.deliver}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingMesa ? i18n.tables.editTable : i18n.tables.newTable}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{i18n.tables.tableNumber}</Text>
              <TextInput
                style={styles.input}
                value={newTableNumber}
                onChangeText={setNewTableNumber}
                placeholder="Ex: 13"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{i18n.tables.capacity}</Text>
              <TextInput
                style={styles.input}
                value={newTableCapacity}
                onChangeText={setNewTableCapacity}
                placeholder="Ex: 4"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalActions}>
              {editingMesa && (
                <TouchableOpacity onPress={handleDelete} style={[styles.deleteButton, isAdding && { opacity: 0.6 }]} disabled={isAdding}>
                  <Ionicons name="trash-outline" size={20} color={Colors.red} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setShowAddModal(false); setEditingMesa(null); }} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{i18n.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.confirmButton, (saveMutation.isPending || deleteMutation.isPending) && { opacity: 0.6 }]}
                disabled={saveMutation.isPending || deleteMutation.isPending}
              >
                {(saveMutation.isPending || deleteMutation.isPending) ? (
                  <ActivityIndicator color={Colors.espresso} size="small" />
                ) : (
                  <Text style={styles.confirmText}>{editingMesa ? i18n.common.save : i18n.common.add}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  notificationButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.surface,
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: Colors.red, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.espresso,
  },
  badgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  addButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center",
  },
  filterScroll: { marginBottom: 12 },
  filterContent: { flexDirection: "row", paddingHorizontal: 16, gap: 10, alignItems: "center" },
  filterChip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface, gap: 8,
  },
  filterChipActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  filterText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  filterTextActive: { color: Colors.espresso },
  filterBadge: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeActive: { backgroundColor: Colors.espresso + "44" },
  filterBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.textMuted },
  filterBadgeTextActive: { color: Colors.espresso },
  grid: { paddingHorizontal: 12, paddingTop: 8, gap: 10 },
  tableCard: { flex: 1, margin: 5 },
  tableCardInner: {
    backgroundColor: Colors.charcoal, borderRadius: 16, padding: 16,
    borderWidth: 1, minHeight: 140, justifyContent: "space-between", gap: 6,
  },
  tableCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tableNumber: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textPrimary },
  tableCapacityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tableCapacity: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  guestName: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  emptyAction: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.amber, borderRadius: 10, marginTop: 4 },
  emptyActionText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.espresso },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContainer: {
    backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, marginBottom: 20 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  emptyNotifications: { alignItems: "center", padding: 40, gap: 12 },
  emptyNotificationsText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textMuted },
  notificationItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.warmDark, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.surface,
  },
  notificationInfo: { gap: 2 },
  notificationMesa: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textPrimary },
  notificationTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },
  deliverButton: {
    backgroundColor: Colors.green, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  deliverButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.espresso },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.warmDark, borderRadius: 12, padding: 14,
    fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.surface,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  deleteButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.red + "22", alignItems: "center", justifyContent: "center" },
  cancelButton: { flex: 1, height: 48, borderRadius: 12, backgroundColor: Colors.warmDark, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  confirmButton: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center" },
  confirmText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
});

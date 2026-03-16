import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

async function fetchTables() {
  const res = await fetch(`${BASE_URL}/api/tables`);
  return res.json();
}

async function createTable(data: { number: number; capacity: number }) {
  const res = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function updateTableStatus(id: number, status: string, guestName?: string) {
  const res = await fetch(`${BASE_URL}/api/tables/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, guestName }),
  });
  return res.json();
}

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";

interface TableData {
  id: number;
  number: number;
  capacity: number;
  status: TableStatus;
  guestName?: string;
}

function TableCard({ table, onPress }: { table: TableData; onPress: () => void }) {
  const color = Colors.statusColors[table.status];
  const label = Colors.statusLabels[table.status];

  return (
    <TouchableOpacity onPress={onPress} style={styles.tableCard} activeOpacity={0.75}>
      <View style={[styles.tableCardInner, { borderColor: color + "33" }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.tableNumber}>Mesa {table.number}</Text>
        <View style={styles.tableCapacityRow}>
          <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.tableCapacity}>{table.capacity}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.statusText, { color }]}>{label}</Text>
        </View>
        {table.guestName ? (
          <Text style={styles.guestName} numberOfLines={1}>{table.guestName}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function TablesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<TableStatus | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [refreshing, setRefreshing] = useState(false);

  const { data: tables = [], isLoading } = useQuery<TableData[]>({
    queryKey: ["tables"],
    queryFn: fetchTables,
    refetchInterval: 15000,
  });

  const addMutation = useMutation({
    mutationFn: createTable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      setShowAddModal(false);
      setNewTableNumber("");
      setNewTableCapacity("4");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["tables"] });
    setRefreshing(false);
  }, [qc]);

  const filtered = filter === "all" ? tables : tables.filter((t) => t.status === filter);

  const counts = {
    all: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
    cleaning: tables.filter((t) => t.status === "cleaning").length,
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filters: Array<{ key: TableStatus | "all"; label: string }> = [
    { key: "all", label: `Todas (${counts.all})` },
    { key: "available", label: `Livres (${counts.available})` },
    { key: "occupied", label: `Ocupadas (${counts.occupied})` },
    { key: "reserved", label: `Reservadas (${counts.reserved})` },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mesas</Text>
          <Text style={styles.subtitle}>{tables.length} mesas • {counts.occupied} ocupadas</Text>
        </View>
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
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.amber} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="restaurant-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Nenhuma mesa encontrada</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Adicionar Mesa</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomPadding + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.amber}
            />
          }
          renderItem={({ item }) => (
            <TableCard
              table={item}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/table/[id]", params: { id: item.id } });
              }}
            />
          )}
        />
      )}

      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nova Mesa</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Número da Mesa</Text>
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
              <Text style={styles.inputLabel}>Capacidade</Text>
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
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!newTableNumber || !newTableCapacity) return;
                  addMutation.mutate({
                    number: Number(newTableNumber),
                    capacity: Number(newTableCapacity),
                  });
                }}
                style={[styles.confirmButton, addMutation.isPending && { opacity: 0.6 }]}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator color={Colors.espresso} size="small" />
                ) : (
                  <Text style={styles.confirmText}>Adicionar</Text>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.amber,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  filterScroll: {
    maxHeight: 48,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.warmDark,
    borderWidth: 1,
    borderColor: Colors.surface,
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
  grid: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  tableCard: {
    flex: 1,
    margin: 5,
  },
  tableCardInner: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: "space-between",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: "flex-end",
  },
  tableNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.textPrimary,
  },
  tableCapacityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tableCapacity: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  guestName: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
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
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textMuted,
  },
  emptyAction: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.amber,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.espresso,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContainer: {
    backgroundColor: Colors.charcoal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.warmDark,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.warmDark,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.amber,
    alignItems: "center",
  },
  confirmText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.espresso,
  },
});

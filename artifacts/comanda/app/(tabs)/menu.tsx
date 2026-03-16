import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface Category {
  id: number;
  name: string;
  icon?: string;
  sortOrder: number;
}

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  categoryId: number;
  categoryName: string;
  available: boolean;
  preparationTime?: number;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/api/categories`);
  return res.json();
}

async function fetchMenuItems(categoryId?: number): Promise<MenuItem[]> {
  const url = categoryId ? `${BASE_URL}/api/menu?categoryId=${categoryId}` : `${BASE_URL}/api/menu`;
  const res = await fetch(url);
  return res.json();
}

async function createMenuItem(data: Partial<MenuItem>) {
  const res = await fetch(`${BASE_URL}/api/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function toggleAvailability(id: number, available: boolean) {
  const res = await fetch(`${BASE_URL}/api/menu/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available }),
  });
  return res.json();
}

function MenuItemCard({ item, onToggle }: { item: MenuItem; onToggle: () => void }) {
  return (
    <View style={[styles.itemCard, !item.available && styles.itemCardDisabled]}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, !item.available && styles.disabledText]}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.itemMeta}>
          {item.preparationTime ? (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaText}>{item.preparationTime}min</Text>
            </View>
          ) : null}
          <Text style={styles.categoryTag}>{item.categoryName}</Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>R$ {Number(item.price).toFixed(2).replace(".", ",")}</Text>
        <Switch
          value={item.available}
          onValueChange={onToggle}
          thumbColor={item.available ? Colors.amber : Colors.textMuted}
          trackColor={{ false: Colors.warmDark, true: Colors.amber + "66" }}
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>
    </View>
  );
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", preparationTime: "", categoryId: 0 });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu", selectedCategory],
    queryFn: () => fetchMenuItems(selectedCategory),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }: { id: number; available: boolean }) => toggleAvailability(id, available),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      Haptics.selectionAsync();
    },
  });

  const createMutation = useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      setShowAddModal(false);
      setForm({ name: "", description: "", price: "", preparationTime: "", categoryId: 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Bebidas: "cafe-outline",
    Entradas: "leaf-outline",
    "Pratos Principais": "restaurant-outline",
    Sobremesas: "ice-cream-outline",
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cardápio</Text>
          <Text style={styles.subtitle}>{items.length} itens</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowAddModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={22} color={Colors.espresso} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        <TouchableOpacity
          onPress={() => setSelectedCategory(undefined)}
          style={[styles.catChip, !selectedCategory && styles.catChipActive]}
        >
          <Ionicons name="grid-outline" size={14} color={!selectedCategory ? Colors.espresso : Colors.textSecondary} />
          <Text style={[styles.catText, !selectedCategory && styles.catTextActive]}>Todos</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => {
              setSelectedCategory(cat.id === selectedCategory ? undefined : cat.id);
              Haptics.selectionAsync();
            }}
            style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
          >
            <Ionicons
              name={categoryIcons[cat.name] ?? "restaurant-outline"}
              size={14}
              color={selectedCategory === cat.id ? Colors.espresso : Colors.textSecondary}
            />
            <Text style={[styles.catText, selectedCategory === cat.id && styles.catTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.amber} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 134 : 100 }]}
          renderItem={({ item }) => (
            <MenuItemCard
              item={item}
              onToggle={() => toggleMutation.mutate({ id: item.id, available: !item.available })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum item nesta categoria</Text>
            </View>
          }
        />
      )}

      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Novo Item</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Nome do item"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Descrição do prato"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Preço (R$) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                    placeholder="0,00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Tempo (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.preparationTime}
                    onChangeText={(v) => setForm((f) => ({ ...f, preparationTime: v }))}
                    placeholder="15"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Categoria *</Text>
                <View style={styles.categorySelect}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setForm((f) => ({ ...f, categoryId: cat.id }))}
                      style={[styles.catOption, form.categoryId === cat.id && styles.catOptionActive]}
                    >
                      <Text style={[styles.catOptionText, form.categoryId === cat.id && styles.catOptionTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!form.name || !form.price || !form.categoryId) return;
                  createMutation.mutate({
                    name: form.name,
                    description: form.description || undefined,
                    price: parseFloat(form.price.replace(",", ".")),
                    categoryId: form.categoryId,
                    preparationTime: form.preparationTime ? parseInt(form.preparationTime) : undefined,
                  });
                }}
                style={[styles.confirmButton, createMutation.isPending && { opacity: 0.6 }]}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
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
  addButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  catScroll: { maxHeight: 48, marginBottom: 8 },
  catContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catTextActive: { color: Colors.espresso },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  itemCard: {
    backgroundColor: Colors.charcoal, borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6,
  },
  itemCardDisabled: { opacity: 0.55 },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary, marginBottom: 4 },
  disabledText: { color: Colors.textMuted },
  itemDescription: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  categoryTag: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.amber },
  itemRight: { alignItems: "flex-end", gap: 6 },
  itemPrice: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.amber },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textMuted },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContainer: {
    backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, maxHeight: "90%",
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.warmDark, borderRadius: 12, padding: 14,
    fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.surface,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  categorySelect: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catOption: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface,
  },
  catOptionActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catOptionText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catOptionTextActive: { color: Colors.espresso },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.warmDark, alignItems: "center",
  },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  confirmButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.amber, alignItems: "center",
  },
  confirmText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
});

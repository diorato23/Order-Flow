import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
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

interface Category {
  id: number;
  name: string;
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

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/api/categories`);
  return res.json();
}

async function fetchMenuItems(categoryId?: number): Promise<MenuItem[]> {
  const url = categoryId
    ? `${BASE_URL}/api/menu?categoryId=${categoryId}&available=true`
    : `${BASE_URL}/api/menu?available=true`;
  const res = await fetch(url);
  return res.json();
}

async function createOrder(data: {
  tableId: number;
  items: { menuItemId: number; quantity: number; notes?: string }[];
  notes?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

function MenuItemTile({ item, quantity, onAdd, onRemove }: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.menuTile}>
      <View style={styles.menuTileInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.menuItemBottom}>
          <Text style={styles.menuItemPrice}>R$ {Number(item.price).toFixed(2).replace(".", ",")}</Text>
          {item.preparationTime ? (
            <View style={styles.prepTime}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.prepTimeText}>{item.preparationTime}min</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.qtyControl}>
        {quantity > 0 ? (
          <>
            <TouchableOpacity onPress={onRemove} style={styles.qtyBtn}>
              <Ionicons name="remove" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{quantity}</Text>
          </>
        ) : null}
        <TouchableOpacity onPress={onAdd} style={[styles.qtyBtn, styles.qtyBtnAdd]}>
          <Ionicons name="add" size={16} color={Colors.espresso} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NewOrderScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{ tableId: string; tableNumber: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [showCart, setShowCart] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu-available", selectedCategory],
    queryFn: () => fetchMenuItems(selectedCategory),
  });

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table-orders", tableId] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
  const cartCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);

  const addToCart = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          menuItem: item,
          quantity: (existing?.quantity ?? 0) + 1,
          notes: existing?.notes ?? "",
        },
      };
    });
  };

  const removeFromCart = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const existing = prev[item.id];
      if (!existing || existing.quantity <= 1) {
        const newCart = { ...prev };
        delete newCart[item.id];
        return newCart;
      }
      return { ...prev, [item.id]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const submitOrder = () => {
    if (cartItems.length === 0 || !tableId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate({
      tableId: Number(tableId),
      notes: orderNotes || undefined,
      items: cartItems.map((ci) => ({
        menuItemId: ci.menuItem.id,
        quantity: ci.quantity,
        notes: ci.notes || undefined,
      })),
    });
  };

  const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Bebidas: "cafe-outline",
    Entradas: "leaf-outline",
    "Pratos Principais": "restaurant-outline",
    Sobremesas: "ice-cream-outline",
  };

  if (showCart) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowCart(false)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Conferir Pedido</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.cartContent}>
          <Text style={styles.cartMesa}>Mesa {tableNumber}</Text>

          {cartItems.map((ci) => (
            <View key={ci.menuItem.id} style={styles.cartRow}>
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => removeFromCart(ci.menuItem)} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{ci.quantity}</Text>
                <TouchableOpacity onPress={() => addToCart(ci.menuItem)} style={[styles.qtyBtn, styles.qtyBtnAdd]}>
                  <Ionicons name="add" size={16} color={Colors.espresso} />
                </TouchableOpacity>
              </View>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{ci.menuItem.name}</Text>
                <TextInput
                  style={styles.notesInput}
                  value={ci.notes}
                  onChangeText={(v) =>
                    setCart((prev) => ({ ...prev, [ci.menuItem.id]: { ...prev[ci.menuItem.id], notes: v } }))
                  }
                  placeholder="Observação (opcional)"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <Text style={styles.cartItemPrice}>
                R$ {(ci.menuItem.price * ci.quantity).toFixed(2).replace(".", ",")}
              </Text>
            </View>
          ))}

          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Observações do pedido</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Ex: cliente alérgico a camarão..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {cartTotal.toFixed(2).replace(".", ",")}</Text>
          </View>
          <TouchableOpacity
            onPress={submitOrder}
            style={[styles.submitButton, createMutation.isPending && { opacity: 0.6 }]}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={Colors.espresso} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={Colors.espresso} />
                <Text style={styles.submitButtonText}>Enviar para Cozinha</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Novo Pedido</Text>
          <Text style={styles.subtitle}>Mesa {tableNumber}</Text>
        </View>
        {cartCount > 0 ? (
          <TouchableOpacity
            onPress={() => setShowCart(true)}
            style={styles.cartButton}
          >
            <Ionicons name="bag-outline" size={20} color={Colors.espresso} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
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
              size={13}
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
          contentContainerStyle={[styles.menuList, { paddingBottom: cartCount > 0 ? 110 : 20 }]}
          renderItem={({ item }) => (
            <MenuItemTile
              item={item}
              quantity={cart[item.id]?.quantity ?? 0}
              onAdd={() => addToCart(item)}
              onRemove={() => removeFromCart(item)}
            />
          )}
        />
      )}

      {cartCount > 0 ? (
        <View style={[styles.cartFooter, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
          <TouchableOpacity onPress={() => setShowCart(true)} style={styles.cartFooterButton}>
            <View style={styles.cartFooterLeft}>
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{cartCount}</Text>
              </View>
              <Text style={styles.cartFooterLabel}>Ver Pedido</Text>
            </View>
            <Text style={styles.cartFooterTotal}>R$ {cartTotal.toFixed(2).replace(".", ",")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  flex: { flex: 1 },
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
  headerCenter: { flex: 1 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },
  cartButton: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center",
  },
  cartBadge: {
    position: "absolute", top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.red, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.espresso,
  },
  cartBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.textPrimary },
  catScroll: { maxHeight: 48, marginBottom: 8 },
  catContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catTextActive: { color: Colors.espresso },
  menuList: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  menuTile: {
    backgroundColor: Colors.charcoal, borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6,
  },
  menuTileInfo: { flex: 1 },
  menuItemName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary, marginBottom: 4 },
  menuItemDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  menuItemBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuItemPrice: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.amber },
  prepTime: { flexDirection: "row", alignItems: "center", gap: 3 },
  prepTimeText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.warmDark, alignItems: "center", justifyContent: "center",
  },
  qtyBtnAdd: { backgroundColor: Colors.amber },
  qtyText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.textPrimary, minWidth: 20, textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  cartFooter: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.charcoal, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.warmDark,
  },
  cartFooterButton: {
    backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  cartFooterLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cartCountBadge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.espresso + "55", alignItems: "center", justifyContent: "center",
  },
  cartCountText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.espresso },
  cartFooterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
  cartFooterTotal: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.espresso },
  cartContent: { padding: 16, gap: 12 },
  cartMesa: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary, marginBottom: 4 },
  cartRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: Colors.charcoal, borderRadius: 14, padding: 12, marginBottom: 6,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textPrimary, marginBottom: 6 },
  cartItemPrice: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.amber, paddingTop: 2 },
  notesInput: {
    backgroundColor: Colors.warmDark, borderRadius: 8, padding: 8,
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.surface,
  },
  notesSection: { marginTop: 8 },
  notesLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.warmDark, borderRadius: 12, padding: 14,
    fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.surface,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  footer: {
    backgroundColor: Colors.charcoal, borderTopWidth: 1, borderTopColor: Colors.warmDark,
    paddingHorizontal: 16, paddingTop: 12, gap: 12,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.green },
  submitButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14,
  },
  submitButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.espresso },
});

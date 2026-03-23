import React, { useState, useCallback, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import type { Categoria, Produto } from "../../lib/supabase/types";
import { i18n } from "../../constants/i18n";
import { triggerN8NWebhook } from "../../lib/n8n";
import { formatCurrency } from "../../lib/format";
import { useAuth } from "../../context/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { offlineStore } from "../../lib/offline/store";


// ─── Tipos Locais ─────────────────────────────────────────────────────────────
interface CartItem {
  produto: Produto & { categoria_nome?: string };
  quantidade: number;
  observacoes: string;
}

// ─── Queries Supabase ─────────────────────────────────────────────────────────
async function fetchCategorias(restauranteId: string): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("comanda_categorias")
    .select("*")
    .eq("restaurante_id", restauranteId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchProdutosDisponiveis(restauranteId: string, categoriaId?: string): Promise<(Produto & { categoria_nome?: string })[]> {
  let query = supabase
    .from("comanda_produtos")
    .select("*, comanda_categorias(nome)")
    .eq("restaurante_id", restauranteId)
    .eq("disponivel", true)
    .order("nome", { ascending: true });
  if (categoriaId) query = query.eq("categoria_id", categoriaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, categoria_nome: p.comanda_categorias?.nome ?? "" }));
}

async function criarPedido(data: {
  mesa_id: string;
  restaurante_id: string;
  garcom_id: string;
  observacoes?: string;
  itens: { produto_id: string; quantidade: number; observacoes?: string; nome_produto: string; preco_unitario: number; subtotal: number }[];
}) {
  const total = data.itens.reduce((s, i) => s + i.subtotal, 0);

  // 1. Criar pedido
  const { data: pedido, error: errPedido } = await supabase
    .from("comanda_pedidos")
    .insert({
      restaurante_id: data.restaurante_id,
      garcom_id: data.garcom_id,
      mesa_id: data.mesa_id,
      observacoes: data.observacoes,
      status: "pendente",
      total,
    })
    .select()
    .single();
  if (errPedido) throw errPedido;

  // 2. Inserir itens
  const { error: errItens } = await supabase.from("comanda_itens_pedido").insert(
    data.itens.map((i) => ({ pedido_id: (pedido as any).id, restaurante_id: data.restaurante_id, ...i }))
  );
  if (errItens) throw errItens;

  // 3. Atualizar status da mesa para "ocupada"
  await supabase.from("comanda_mesas").update({ status: "ocupada" }).eq("id", data.mesa_id);

  return pedido;
}

// ─── Card de produto ──────────────────────────────────────────────────────────
function MenuItemTile({ item, quantidade, onAdd, onRemove }: {
  item: Produto & { categoria_nome?: string };
  quantidade: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.menuTile}>
      <View style={styles.menuTileInfo}>
        <Text style={styles.menuItemName}>{item.nome}</Text>
        {item.descricao ? <Text style={styles.menuItemDesc} numberOfLines={2}>{item.descricao}</Text> : null}
        <View style={styles.menuItemBottom}>
          <Text style={styles.menuItemPrice}>{formatCurrency(Number(item.preco))}</Text>
          {item.tempo_preparo ? (
            <View style={styles.prepTime}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.prepTimeText}>{item.tempo_preparo}min</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.qtyControl}>
        {quantidade > 0 ? (
          <>
            <TouchableOpacity onPress={onRemove} style={styles.qtyBtn}>
              <Ionicons name="remove" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{quantidade}</Text>
          </>
        ) : null}
        <TouchableOpacity onPress={onAdd} style={[styles.qtyBtn, styles.qtyBtnAdd]}>
          <Ionicons name="add" size={16} color={Colors.espresso} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function NewOrderScreen() {
  const { tableId, tableNumber, orderId } = useLocalSearchParams<{ tableId: string; tableNumber: string; orderId?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<(Produto & { categoria_nome?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string | undefined>();
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [showCart, setShowCart] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { profile } = useAuth();

  const loadCategorias = useCallback(async () => {
    if (!profile?.restaurante_id) return;
    try {
      const data = await fetchCategorias(profile.restaurante_id);
      setCategorias(data);
    } catch (e) {
      console.error("Erro ao carregar categorias:", e);
    }
  }, [profile?.restaurante_id]);

  const loadProdutos = useCallback(async (catId?: string) => {
    if (!profile?.restaurante_id) return;
    setIsLoading(true);
    try {
      const data = await fetchProdutosDisponiveis(profile.restaurante_id, catId);
      setProdutos(data);
    } catch (e) {
      console.error("Erro ao carregar produtos:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.restaurante_id]);

  const loadExistingOrder = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      // 1. Buscar o pedido
      const { data: pedido, error: errP } = await supabase
        .from("comanda_pedidos")
        .select("*")
        .eq("id", orderId)
        .single();
      if (errP) throw errP;
      if (pedido.observacoes) setOrderNotes(pedido.observacoes);

      // 2. Buscar os itens
      const { data: itens, error: errI } = await supabase
        .from("comanda_itens_pedido")
        .select("*, comanda_produtos(*, comanda_categorias(nome))")
        .eq("pedido_id", orderId);
      if (errI) throw errI;

      // 3. Popular o carrinho
      const newCart: Record<string, CartItem> = {};
      itens.forEach((it: any) => {
        const prod = {
          ...it.comanda_produtos,
          categoria_nome: it.comanda_produtos.comanda_categorias?.nome || ""
        };
        newCart[it.produto_id] = {
          produto: prod,
          quantidade: it.quantidade,
          observacoes: it.observacoes || ""
        };
      });
      setCart(newCart);
    } catch (e) {
      console.error("Erro ao carregar pedido para edição:", e);
      Alert.alert("Erro", "Não foi possível carregar o pedido para edição.");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => { 
    loadCategorias(); 
    if (orderId) {
      loadExistingOrder();
    } else {
      loadProdutos();
    }
  }, [loadCategorias, loadProdutos, loadExistingOrder, orderId]);

  useEffect(() => { 
    if (!orderId) loadProdutos(selectedCategoria); 
  }, [selectedCategoria, loadProdutos, orderId]);

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((s, ci) => s + Number(ci.produto.preco) * ci.quantidade, 0);
  const cartCount = cartItems.reduce((s, ci) => s + ci.quantidade, 0);

  const addToCart = (item: Produto & { categoria_nome?: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => ({
      ...prev,
      [item.id]: {
        produto: item,
        quantidade: (prev[item.id]?.quantidade ?? 0) + 1,
        observacoes: prev[item.id]?.observacoes ?? "",
      },
    }));
  };

  const removeFromCart = (item: Produto) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const existing = prev[item.id];
      if (!existing || existing.quantidade <= 1) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: { ...existing, quantidade: existing.quantidade - 1 } };
    });
  };

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      let data, error;

      if (orderId) {
        // MODO EDIÇÃO
        // 1. Atualizar o pedido principal
        const { data: pData, error: pError } = await supabase
          .from("comanda_pedidos")
          .update({
            observacoes: orderData.observacoes,
            total: orderData.total,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", orderId)
          .select()
          .single();
        
        data = pData;
        error = pError;

        if (!error) {
          // 2. Remover itens antigos
          await supabase.from("comanda_itens_pedido").delete().eq("pedido_id", orderId);
        }
      } else {
        // MODO NOVO PEDIDO
        const { data: pData, error: pError } = await supabase.from("comanda_pedidos").insert({
          mesa_id: orderData.mesa_id,
          restaurante_id: orderData.restaurante_id,
          garcom_id: orderData.garcom_id,
          observacoes: orderData.observacoes,
          total: orderData.total,
          status: "pendente",
        }).select().single();
        
        data = pData;
        error = pError;
      }

      if (error) {
        // Se falhar (ex: sem internet), salvar na fila offline
        const isNetworkError = (error as any).message?.includes("fetch") || !(error as any).status || (error as any).code === "PGRST_FETCH_ERROR";
        
        if (isNetworkError) {
          console.log("[Offline] Detectada falha de rede, salvando pedido offline...");
          await offlineStore.addToQueue({
            table: "comanda_pedidos",
            action: orderId ? "update" : "insert",
            data: orderId ? {
              id: orderId,
              observacoes: orderData.observacoes,
              total: orderData.total,
              atualizado_em: new Date().toISOString()
            } : {
              mesa_id: orderData.mesa_id,
              restaurante_id: orderData.restaurante_id,
              garcom_id: orderData.garcom_id,
              observacoes: orderData.observacoes,
              total: orderData.total,
              status: "pendente",
            }
          });
          
          return { offline: true };
        }
        throw error;
      }

      // 2. Criar itens do pedido
      const itensComPedidoId = orderData.itens.map((item: any) => ({
        ...item,
        pedido_id: data.id,
        restaurante_id: orderData.restaurante_id,
      }));

      const { error: itemsError } = await supabase.from("comanda_itens_pedido").insert(itensComPedidoId);
      if (itemsError) throw itemsError;

      // 3. Atualizar mesa para ocupada
      await supabase.from("comanda_mesas").update({ status: "ocupada" }).eq("id", orderData.mesa_id);

      // 4. Notificar n8n (em segundo plano)
      const webhookEvent = orderId ? "pedido_alterado" : "novo_pedido";
      triggerN8NWebhook(webhookEvent, orderData.webhookData).catch(err => console.error("Erro n8n:", err));

      return data;
    },
    onMutate: async (newOrder) => {
      // Cancelar refetches para não sobrescrever o update otimista
      await queryClient.cancelQueries({ queryKey: ["mesa-detalhes", tableId] });

      // Snapshot do valor anterior
      const previousDetails = queryClient.getQueryData(["mesa-detalhes", tableId]);

      // Update otimista (apenas se for novo pedido, para simplificar)
      if (!orderId) {
        queryClient.setQueryData(["mesa-detalhes", tableId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            comanda_pedidos: [
              ...(old.comanda_pedidos || []),
              { 
                id: "temp-id-" + Date.now(), 
                status: "pendente", 
                created_at: new Date().toISOString(),
                total: cartTotal 
              }
            ]
          };
        });
      }

      return { previousDetails };
    },
    onError: (err, newOrder, context) => {
      // Rollback em caso de erro
      if (context?.previousDetails) {
        queryClient.setQueryData(["mesa-detalhes", tableId], context.previousDetails);
      }
      Alert.alert(i18n.common.error, "No se pudo enviar el pedido. Intente nuevamente.");
    },
    onSettled: () => {
      // Sincronizar com o servidor
      queryClient.invalidateQueries({ queryKey: ["mesa-detalhes", tableId] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
    onSuccess: (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (data?.offline) {
        Alert.alert(
          "Pedido Salvo Offline", 
          "Você está sem internet ou o servidor está instável. O pedido foi salvo no dispositivo e será enviado assim que a conexão voltar.",
          [{ text: "Entendido", onPress: () => router.back() }]
        );
      } else {
        router.back();
      }
    }
  });

  const submitOrder = async () => {
    if (cartItems.length === 0 || !tableId || !profile) return;
    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const itensFormatados = cartItems.map(ci => 
      `${ci.quantidade}x ${ci.produto.nome}${ci.observacoes ? ` (${ci.observacoes})` : ""}`
    ).join("\n");

    const orderData = {
      mesa_id: tableId,
      restaurante_id: profile.restaurante_id,
      garcom_id: profile.id,
      observacoes: orderNotes || undefined,
      total: cartTotal,
      itens: cartItems.map((ci) => ({
        produto_id: ci.produto.id,
        quantidade: ci.quantidade,
        observacoes: ci.observacoes || undefined,
        nome_produto: ci.produto.nome,
        preco_unitario: Number(ci.produto.preco),
        subtotal: Number(ci.produto.preco) * ci.quantidade,
      })),
      webhookData: {
        mesa_id: tableId,
        mesa_numero: tableNumber,
        mesero_nome: profile.nome,
        observacoes: orderNotes || "",
        total: cartTotal,
        itens: itensFormatados,
      }
    };

    try {
      await createOrderMutation.mutateAsync(orderData);
    } catch (e) {
      console.error("Erro ao processar pedido:", e);
    } finally {
      setIsSending(false);
    }
  };

  const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Bebidas: "cafe-outline",
    Entradas: "leaf-outline",
    "Pratos Principais": "restaurant-outline",
    Sobremesas: "ice-cream-outline",
  };

  // ─── Tela do Carrinho ────────────────────────────────────────────────────────
  if (showCart) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowCart(false)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{orderId ? "Editar Pedido" : i18n.details.checkOrder}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.cartContent}>
          <Text style={styles.cartMesa}>{tableNumber ? i18n.tables.tableName(Number(tableNumber)) : i18n.tables.title}</Text>
          {cartItems.map((ci) => (
            <View key={ci.produto.id} style={styles.cartRow}>
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => removeFromCart(ci.produto)} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{ci.quantidade}</Text>
                <TouchableOpacity onPress={() => addToCart(ci.produto)} style={[styles.qtyBtn, styles.qtyBtnAdd]}>
                  <Ionicons name="add" size={16} color={Colors.espresso} />
                </TouchableOpacity>
              </View>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{ci.produto.nome}</Text>
                <TextInput
                  style={styles.notesInput}
                  value={ci.observacoes}
                  onChangeText={(v) =>
                    setCart((prev) => ({ ...prev, [ci.produto.id]: { ...prev[ci.produto.id], observacoes: v } }))
                  }
                  placeholder={i18n.details.placeholderItemNotes}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <Text style={styles.cartItemPrice}>
                {formatCurrency(Number(ci.produto.preco) * ci.quantidade)}
              </Text>
            </View>
          ))}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>{i18n.details.orderNotes}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder={i18n.details.placeholderNotes}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) }]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{i18n.dashboard.orders}</Text>
            <Text style={styles.totalValue}>{formatCurrency(cartTotal)}</Text>
          </View>
          <TouchableOpacity onPress={submitOrder} style={[styles.submitButton, isSending && { opacity: 0.6 }]} disabled={isSending}>
            {isSending ? (
              <ActivityIndicator color={Colors.espresso} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={Colors.espresso} />
                <Text style={styles.submitButtonText}>{i18n.details.sendToKitchen}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Tela do Cardápio ────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{i18n.details.newOrder}</Text>
          <Text style={styles.subtitle}>{tableNumber ? i18n.tables.tableName(Number(tableNumber)) : ""}</Text>
        </View>
        {cartCount > 0 ? (
          <TouchableOpacity onPress={() => setShowCart(true)} style={styles.cartButton}>
            <Ionicons name="bag-outline" size={20} color={Colors.espresso} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        <TouchableOpacity onPress={() => setSelectedCategoria(undefined)} style={[styles.catChip, !selectedCategoria && styles.catChipActive]}>
          <Text style={[styles.catText, !selectedCategoria && styles.catTextActive]}>{i18n.common.all}</Text>
        </TouchableOpacity>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => { setSelectedCategoria(cat.id === selectedCategoria ? undefined : cat.id); Haptics.selectionAsync(); }}
            style={[styles.catChip, selectedCategoria === cat.id && styles.catChipActive]}
          >
            <Ionicons name={categoryIcons[cat.nome] ?? "restaurant-outline"} size={13} color={selectedCategoria === cat.id ? Colors.espresso : Colors.textSecondary} />
            <Text style={[styles.catText, selectedCategoria === cat.id && styles.catTextActive]}>{cat.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.amber} size="large" /></View>
      ) : (
        <FlatList
          data={produtos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.menuList, { paddingBottom: cartCount > 0 ? 110 : 20 }]}
          renderItem={({ item }) => (
            <MenuItemTile
              item={item}
              quantidade={cart[item.id]?.quantidade ?? 0}
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
              <Text style={styles.cartFooterLabel}>{i18n.details.viewOrder}</Text>
            </View>
            <Text style={styles.cartFooterTotal}>{formatCurrency(cartTotal)}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.charcoal, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },
  cartButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.red, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.espresso },
  cartBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.textPrimary },
  catScroll: { marginBottom: 12 },
  catContent: { flexDirection: "row", paddingHorizontal: 16, gap: 10, alignItems: "center" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface },
  catChipActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catTextActive: { color: Colors.espresso },
  menuList: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  menuTile: { backgroundColor: Colors.charcoal, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  menuTileInfo: { flex: 1 },
  menuItemName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary, marginBottom: 4 },
  menuItemDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  menuItemBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuItemPrice: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.amber },
  prepTime: { flexDirection: "row", alignItems: "center", gap: 3 },
  prepTimeText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.warmDark, alignItems: "center", justifyContent: "center" },
  qtyBtnAdd: { backgroundColor: Colors.amber },
  qtyText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.textPrimary, minWidth: 20, textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  cartFooter: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.charcoal, padding: 16, borderTopWidth: 1, borderTopColor: Colors.warmDark },
  cartFooterButton: { backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cartFooterLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  cartCountBadge: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.espresso + "55", alignItems: "center", justifyContent: "center" },
  cartCountText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.espresso },
  cartFooterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
  cartFooterTotal: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.espresso },
  cartContent: { padding: 16, gap: 12 },
  cartMesa: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary, marginBottom: 4 },
  cartRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.charcoal, borderRadius: 14, padding: 12, marginBottom: 6 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textPrimary, marginBottom: 6 },
  cartItemPrice: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.amber, paddingTop: 2 },
  notesInput: { backgroundColor: Colors.warmDark, borderRadius: 8, padding: 8, fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surface },
  notesSection: { marginTop: 8 },
  notesLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: Colors.warmDark, borderRadius: 12, padding: 14, fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surface },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  footer: { backgroundColor: Colors.charcoal, borderTopWidth: 1, borderTopColor: Colors.warmDark, paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.green },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14 },
  submitButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.espresso },
});

import React, { useState, useCallback, useEffect } from "react";
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
  Alert,
  LayoutAnimation,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import type { Categoria, Produto } from "../../lib/supabase/types";
import { i18n } from "../../constants/i18n";
import { useAuth } from "../../context/auth";
import ProductSkeleton from "../../components/ProductSkeleton";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";




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

async function fetchProdutos(restauranteId: string, categoriaId?: string): Promise<(Produto & { categoria_nome?: string })[]> {
  let query = supabase
    .from("comanda_produtos")
    .select("*, comanda_categorias(nome)")
    .eq("restaurante_id", restauranteId)
    .order("nome", { ascending: true });
  if (categoriaId) query = query.eq("categoria_id", categoriaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    ...p,
    categoria_nome: p.comanda_categorias?.nome ?? "",
  }));
}

async function criarProduto(restauranteId: string, data: {
  nome: string;
  descricao?: string;
  preco: number;
  categoria_id: string;
  tempo_preparo?: number;
}) {
  // @ts-ignore
  const { error } = await supabase.from("comanda_produtos").insert({
    ...data,
    restaurante_id: restauranteId,
  });
  if (error) throw error;
}

async function criarCategoria(restauranteId: string, nome: string) {
  // @ts-ignore
  const { error } = await (supabase as any).from("comanda_categorias").insert({
    restaurante_id: restauranteId,
    nome,
    ordem: 99,
  });
  if (error) throw error;
}

async function atualizarCategoria(id: string, nome: string) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_categorias")
    .update({ nome })
    .eq("id", id);
  if (error) throw error;
}

async function excluirCategoria(id: string) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_categorias")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function toggleDisponivel(id: string, disponivel: boolean) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_produtos")
    .update({ disponivel })
    .eq("id", id);
  if (error) throw error;
}

async function atualizarProduto(id: string, data: any) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_produtos")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}

async function excluirProduto(id: string) {
  // @ts-ignore
  const { error } = await (supabase as any)
    .from("comanda_produtos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Card do Produto ──────────────────────────────────────────────────────────
const MenuItemCard = React.memo(({ item, onToggle, onEdit, index }: { item: Produto & { categoria_nome?: string }; onToggle: () => void; onEdit: () => void; index: number }) => {
  const router = useRouter();
  
  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition}
    >
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={onEdit}
        style={[styles.itemCard, !item.disponivel && styles.itemCardDisabled]}
      >
        <Animated.Image 
          source={{ uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop" }} 
          style={styles.itemImage}
          // @ts-ignore
          sharedTransitionTag={`product-img-${item.id}`}
        />
      
      <View style={styles.itemInfo}>
        <View style={styles.itemNameRow}>
          <Text style={[styles.itemName, !item.disponivel && styles.disabledText]}>{item.nome}</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={10}>
            <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        {item.descricao ? (
          <Text style={styles.itemDescription} numberOfLines={2}>{item.descricao}</Text>
        ) : null}
        <View style={styles.itemMeta}>
          {item.tempo_preparo ? (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaText}>{item.tempo_preparo}min</Text>
            </View>
          ) : null}
          {item.categoria_nome ? (
            <Text style={styles.categoryTag}>{item.categoria_nome}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>{i18n.common.currency} {Number(item.preco).toFixed(2).replace(".", ",")}</Text>
        <Switch
          value={item.disponivel}
          onValueChange={onToggle}
          thumbColor={item.disponivel ? Colors.amber : Colors.textMuted}
          trackColor={{ false: Colors.warmDark, true: Colors.amber + "66" }}
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedCategoria, setSelectedCategoria] = useState<string | undefined>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showEditCatModal, setShowEditCatModal] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [editCatName, setEditCatName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", descricao: "", preco: "", tempo_preparo: "", categoria_id: "",
  });
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ editId?: string }>();

  // Efeito para abrir edição vindo da tela de detalhes
  useEffect(() => {
    if (params.editId && produtos.length > 0 && !editingProduto && !showAddModal) {
      const p = produtos.find(item => item.id === params.editId);
      if (p) {
        handleEditPress(p);
        // Limpa o parâmetro para não reabrir
        router.setParams({ editId: undefined });
      }
    }
  }, [params.editId, produtos, editingProduto, showAddModal, qc]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", profile?.restaurante_id],
    queryFn: () => fetchCategorias(profile?.restaurante_id || ""),
    enabled: !!profile?.restaurante_id,
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos", profile?.restaurante_id, selectedCategoria],
    queryFn: () => fetchProdutos(profile?.restaurante_id || "", selectedCategoria),
    enabled: !!profile?.restaurante_id,
  });

  // Mutação para salvar/atualizar produto
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingProduto) {
        return atualizarProduto(editingProduto.id, payload);
      }
      return criarProduto(profile?.restaurante_id || "", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      setShowAddModal(false);
      setEditingProduto(null);
      setForm({ nome: "", descricao: "", preco: "", tempo_preparo: "", categoria_id: "" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Erro", "Não foi possível salvar o produto.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => excluirProduto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      setShowAddModal(false);
      setEditingProduto(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Erro", "Não foi possível excluir o produto.");
    }
  });

  const handleToggle = async (id: string, disponivel: boolean) => {
    try {
      await toggleDisponivel(id, disponivel);
      Haptics.selectionAsync();
      qc.invalidateQueries({ queryKey: ["produtos"] });
    } catch (e) { console.error(e); }
  };

  const handleCreateCategoria = async () => {
    if (!profile?.restaurante_id || !newCatName.trim()) return;
    setIsSaving(true);
    try {
      await criarCategoria(profile.restaurante_id, newCatName.trim());
      qc.invalidateQueries({ queryKey: ["categorias"] });
      setShowAddCatModal(false);
      setNewCatName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível criar a categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCategoria = async () => {
    if (!editingCategoria || !editCatName.trim()) return;
    setIsSaving(true);
    try {
      await atualizarCategoria(editingCategoria.id, editCatName.trim());
      qc.invalidateQueries({ queryKey: ["categorias"] });
      setShowEditCatModal(false);
      setEditingCategoria(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível atualizar a categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategoria = async () => {
    if (!editingCategoria) return;
    Alert.alert(i18n.common.confirm, "Deseja excluir a categoria? Os produtos atrelados poderão ficar sem categoria.", [
      { text: i18n.common.cancel, style: "cancel" },
      { text: i18n.common.delete, style: "destructive", onPress: async () => {
        setIsSaving(true);
        try {
          await excluirCategoria(editingCategoria.id);
          if (selectedCategoria === editingCategoria.id) setSelectedCategoria(undefined);
          qc.invalidateQueries({ queryKey: ["categorias"] });
          qc.invalidateQueries({ queryKey: ["produtos"] });
          setShowEditCatModal(false);
          setEditingCategoria(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch(e) {
          console.error(e);
          Alert.alert("Erro", "Não foi possível excluir a categoria.");
        } finally {
          setIsSaving(false);
        }
      }}
    ]);
  };

  const handleCreate = async () => {
    if (!form.nome || !form.preco || !form.categoria_id) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios (*)");
      return;
    }

    const payload = {
      nome: form.nome,
      descricao: form.descricao || undefined,
      preco: parseFloat(form.preco.replace(",", ".")),
      categoria_id: form.categoria_id,
      tempo_preparo: form.tempo_preparo ? parseInt(form.tempo_preparo) : undefined,
    };

    saveMutation.mutate(payload);
  };

  const handleDelete = async () => {
    if (!editingProduto) return;
    Alert.alert(
      i18n.common.confirm,
      i18n.menu.deleteConfirm,
      [
        { text: i18n.common.cancel, style: "cancel" },
        {
          text: i18n.common.delete,
          style: "destructive",
          onPress: () => deleteMutation.mutate(editingProduto.id)
        }
      ]
    );
  };

  const handleEditPress = (p: Produto) => {
    setEditingProduto(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao || "",
      preco: Number(p.preco).toFixed(2).replace(".", ","),
      tempo_preparo: p.tempo_preparo ? String(p.tempo_preparo) : "",
      categoria_id: p.categoria_id || "",
    });
    setShowAddModal(true);
  };

  const handlePriceChange = (text: string) => {
    // Apenas números
    const cleanNumber = text.replace(/[^0-9]/g, "");
    if (!cleanNumber) {
      setForm(f => ({ ...f, preco: "" }));
      return;
    }
    
    // Formata como 0,00
    const amount = parseInt(cleanNumber) / 100;
    const formatted = amount.toFixed(2).replace(".", ",");
    setForm(f => ({ ...f, preco: formatted }));
  };

  const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Bebidas: "cafe-outline",
    Drinks: "cafe-outline",
    Entradas: "leaf-outline",
    "Pratos Principais": "restaurant-outline",
    Sobremesas: "ice-cream-outline",
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{i18n.menu.title}</Text>
          <Text style={styles.subtitle}>{i18n.menu.subtitle(produtos.length)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setEditingProduto(null);
            setForm({
              nome: "",
              descricao: "",
              preco: "",
              tempo_preparo: "",
              categoria_id: selectedCategoria || "",
            });
            setShowAddModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={22} color={Colors.espresso} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        <TouchableOpacity onPress={() => setSelectedCategoria(undefined)} style={[styles.catChip, !selectedCategoria && styles.catChipActive]}>
          <Ionicons name="grid-outline" size={14} color={!selectedCategoria ? Colors.espresso : Colors.textSecondary} />
          <Text style={[styles.catText, !selectedCategoria && styles.catTextActive]}>{i18n.common.all}</Text>
        </TouchableOpacity>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => { setSelectedCategoria(cat.id === selectedCategoria ? undefined : cat.id); Haptics.selectionAsync(); }}
            onLongPress={() => {
              setEditingCategoria(cat);
              setEditCatName(cat.nome);
              setShowEditCatModal(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[styles.catChip, selectedCategoria === cat.id && styles.catChipActive]}
          >
            <Ionicons
              name={categoryIcons[cat.nome] ?? "restaurant-outline"}
              size={14}
              color={selectedCategoria === cat.id ? Colors.espresso : Colors.textSecondary}
            />
            <Text style={[styles.catText, selectedCategoria === cat.id && styles.catTextActive]}>{cat.nome}</Text>
          </TouchableOpacity>
        ))}
        {/* Adicionar nova categoria */}
        <TouchableOpacity
          onPress={() => { setShowAddCatModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={[styles.catChip, { borderStyle: "dashed", borderColor: Colors.textSecondary }]}
        >
          <Ionicons name="add" size={14} color={Colors.textSecondary} />
          <Text style={styles.catText}>Nova Categoria</Text>
        </TouchableOpacity>
      </ScrollView>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={produtos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 134 : 100 }]}
          renderItem={({ item, index }) => (
            <MenuItemCard 
              item={item} 
              index={index}
              onToggle={() => handleToggle(item.id, !item.disponivel)} 
              onEdit={() => handleEditPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{i18n.menu.empty}</Text>
            </View>
          }
        />
      )}

      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingProduto ? i18n.menu.editItem : i18n.menu.newItem}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{i18n.menu.name} *</Text>
                <TextInput style={styles.input} value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder={i18n.menu.placeholderName} placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{i18n.menu.description}</Text>
                <TextInput style={[styles.input, styles.textArea]} value={form.descricao || ""} onChangeText={(v) => setForm((f) => ({ ...f, descricao: v }))} placeholder={i18n.menu.placeholderDesc} placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>{i18n.menu.price} ({i18n.common.currency}) *</Text>
                  <TextInput style={styles.input} value={form.preco} onChangeText={handlePriceChange} placeholder={i18n.menu.placeholderPrice} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>{i18n.menu.prepTime}</Text>
                  <TextInput style={styles.input} value={form.tempo_preparo} onChangeText={(v) => setForm((f) => ({ ...f, tempo_preparo: v }))} placeholder={i18n.menu.placeholderTime} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{i18n.menu.category} *</Text>

                <View style={styles.categorySelect}>
                  {categorias.map((cat) => (
                    <TouchableOpacity key={cat.id} onPress={() => setForm((f) => ({ ...f, categoria_id: cat.id }))} style={[styles.catOption, form.categoria_id === cat.id && styles.catOptionActive]}>
                      <Text style={[styles.catOptionText, form.categoria_id === cat.id && styles.catOptionTextActive]}>{cat.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              {editingProduto && (
                <TouchableOpacity onPress={handleDelete} style={[styles.deleteButton, isSaving && { opacity: 0.6 }]} disabled={isSaving}>
                  <Ionicons name="trash-outline" size={20} color={Colors.red} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setShowAddModal(false); setEditingProduto(null); }} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{i18n.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={[styles.confirmButton, (saveMutation.isPending || deleteMutation.isPending) && { opacity: 0.6 }]} disabled={saveMutation.isPending || deleteMutation.isPending}>
                {(saveMutation.isPending || deleteMutation.isPending) ? <ActivityIndicator color={Colors.espresso} size="small" /> : <Text style={styles.confirmText}>{editingProduto ? i18n.common.save : i18n.common.add}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Nova Categoria */}
      <Modal visible={showAddCatModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nova Categoria</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome da Categoria *</Text>
              <TextInput 
                style={styles.input} 
                value={newCatName} 
                onChangeText={setNewCatName} 
                placeholder="Ex Ex: Bebidas, Entradas..." 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddCatModal(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{i18n.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateCategoria} style={[styles.confirmButton, isSaving && { opacity: 0.6 }]} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.espresso} size="small" /> : <Text style={styles.confirmText}>{i18n.common.add}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Editar Categoria */}
      <Modal visible={showEditCatModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{i18n.menu.editItem.replace("Item", "Categoria")}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome da Categoria *</Text>
              <TextInput 
                style={styles.input} 
                value={editCatName} 
                onChangeText={setEditCatName} 
                placeholder="Ex Ex: Bebidas, Entradas..." 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={handleDeleteCategoria} style={[styles.deleteButton, isSaving && { opacity: 0.6 }]} disabled={isSaving}>
                <Ionicons name="trash-outline" size={20} color={Colors.red} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowEditCatModal(false); setEditingCategoria(null); }} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{i18n.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateCategoria} style={[styles.confirmButton, isSaving && { opacity: 0.6 }]} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.espresso} size="small" /> : <Text style={styles.confirmText}>{i18n.common.save}</Text>}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.amber, alignItems: "center", justifyContent: "center" },
  catScroll: { marginBottom: 12 },
  catContent: { flexDirection: "row", paddingHorizontal: 16, gap: 10, alignItems: "center" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface },
  catChipActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catTextActive: { color: Colors.espresso },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  itemCard: { backgroundColor: Colors.charcoal, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6 },
  itemCardDisabled: { opacity: 0.55 },
  itemImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: Colors.warmDark },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  itemName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textPrimary },
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
  modalContainer: { backgroundColor: Colors.charcoal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "90%" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surface, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: Colors.warmDark, borderRadius: 12, padding: 14, fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surface },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  categorySelect: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.warmDark, borderWidth: 1, borderColor: Colors.surface },
  catOptionActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  catOptionText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catOptionTextActive: { color: Colors.espresso },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  deleteButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.red + "22", alignItems: "center", justifyContent: "center" },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.warmDark, alignItems: "center" },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  confirmButton: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.amber, alignItems: "center" },
  confirmText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.espresso },
});

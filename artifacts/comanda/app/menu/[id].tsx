import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { i18n } from '@/constants/i18n';
import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase/client';
import type { Produto } from '@/lib/supabase/types';

const { width } = Dimensions.get('window');

type ProdutoDetalhes = Produto & { comanda_categorias: { nome: string } | null };

async function fetchProduto(id: string): Promise<ProdutoDetalhes> {
  const { data, error } = await supabase
    .from('comanda_produtos')
    .select('*, comanda_categorias(nome)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as ProdutoDetalhes;
}

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: () => fetchProduto(id),
    enabled: !!id,
  });

  if (isLoading || !produto) {
    return (
      <View style={styles.loading}>
        <Animated.View entering={FadeIn} style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{i18n.common.loading}</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Imagem com Shared Transition */}
        <Animated.Image 
          source={{ uri: produto?.imagem_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop" }} 
          style={styles.image}
        />

        {/* Header Flutuante */}
        <View style={[styles.headerActions, { top: insets.top + 10 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(200)}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{produto.comanda_categorias?.nome}</Text>
              {produto.tempo_preparo && (
                <View style={styles.timeChip}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.timeText}>{produto.tempo_preparo} min</Text>
                </View>
              )}
            </View>

            <Text style={styles.title}>{produto.nome}</Text>
            <Text style={styles.price}>
              {i18n.common.currency} {Number(produto.preco).toFixed(2).replace('.', ',')}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>{i18n.menu.description}</Text>
            <Text style={styles.description}>
              {produto.descricao || "Sem descrição disponível para este produto."}
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Rodapé de Ação */}
      <Animated.View 
        entering={FadeInDown.delay(400)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}
      >
        <TouchableOpacity 
          style={styles.mainButton}
          onPress={() => router.replace({ pathname: '/(tabs)/menu', params: { editId: id } })}
        >
          <Text style={styles.mainButtonText}>Editar Produto</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  loading: { flex: 1, backgroundColor: Colors.espresso, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12, fontFamily: 'Inter_500Medium' },
  image: {
    width: width,
    height: width * 0.8,
    backgroundColor: Colors.warmDark,
  },
  headerActions: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    backgroundColor: Colors.espresso,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  price: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.amber,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surface,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.espresso,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  mainButton: {
    backgroundColor: Colors.amber,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  mainButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.espresso,
  },
});

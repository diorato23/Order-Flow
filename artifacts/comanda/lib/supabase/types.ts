// Tipos gerados automaticamente pelo Supabase para o projeto finanzas-app
// Tabelas do Comanda-APP usam prefixo: comanda_
// Para regenerar: supabase gen types typescript --project-id wjmrssbofvejpecoqjwi

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      comanda_categorias: {
        Row: {
          criado_em: string
          icone: string | null
          id: string
          nome: string
          ordem: number
          restaurante_id: string
        }
        Insert: {
          criado_em?: string
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          restaurante_id: string
        }
        Update: {
          criado_em?: string
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          restaurante_id?: string
        }
      }
      comanda_clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string | null
          id: string
          nome: string
          pontos_fidelidade: number
          restaurante_id: string
          telefone: string | null
          total_gasto: number
          total_visitas: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome: string
          pontos_fidelidade?: number
          restaurante_id: string
          telefone?: string | null
          total_gasto?: number
          total_visitas?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          pontos_fidelidade?: number
          restaurante_id?: string
          telefone?: string | null
          total_gasto?: number
          total_visitas?: number
        }
      }
      comanda_itens_pedido: {
        Row: {
          criado_em: string
          id: string
          nome_produto: string
          observacoes: string | null
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          criado_em?: string
          id?: string
          nome_produto: string
          observacoes?: string | null
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade?: number
          subtotal: number
        }
        Update: {
          criado_em?: string
          id?: string
          nome_produto?: string
          observacoes?: string | null
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
      }
      comanda_mesas: {
        Row: {
          atualizado_em: string
          capacidade: number
          criado_em: string
          id: string
          nome_cliente: string | null
          numero: number
          restaurante_id: string
          status: 'disponivel' | 'ocupada' | 'reservada' | 'limpeza'
        }
        Insert: {
          atualizado_em?: string
          capacidade?: number
          criado_em?: string
          id?: string
          nome_cliente?: string | null
          numero: number
          restaurante_id: string
          status?: 'disponivel' | 'ocupada' | 'reservada' | 'limpeza'
        }
        Update: {
          atualizado_em?: string
          capacidade?: number
          criado_em?: string
          id?: string
          nome_cliente?: string | null
          numero?: number
          restaurante_id?: string
          status?: 'disponivel' | 'ocupada' | 'reservada' | 'limpeza'
        }
      }
      comanda_pedidos: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          criado_em: string
          garcom_id: string | null
          id: string
          mesa_id: string | null
          observacoes: string | null
          restaurante_id: string
          status: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
          total: number
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          garcom_id?: string | null
          id?: string
          mesa_id?: string | null
          observacoes?: string | null
          restaurante_id: string
          status?: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
          total?: number
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          garcom_id?: string | null
          id?: string
          mesa_id?: string | null
          observacoes?: string | null
          restaurante_id?: string
          status?: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
          total?: number
        }
      }
      comanda_produtos: {
        Row: {
          atualizado_em: string
          categoria_id: string | null
          criado_em: string
          descricao: string | null
          disponivel: boolean
          estoque: number | null
          id: string
          imagem_url: string | null
          nome: string
          preco: number
          restaurante_id: string
          tempo_preparo: number | null
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          nome: string
          preco: number
          restaurante_id: string
          tempo_preparo?: number | null
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          nome?: string
          preco?: number
          restaurante_id?: string
          tempo_preparo?: number | null
        }
      }
      comanda_restaurantes: {
        Row: {
          atualizado_em: string
          criado_em: string
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
      }
      comanda_usuarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          auth_user_id: string | null
          criado_em: string
          funcao: 'garcom' | 'mesero' | 'gerente' | 'admin'
          id: string
          nome: string
          push_token: string | null
          restaurante_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          auth_user_id?: string | null
          criado_em?: string
          funcao?: 'garcom' | 'mesero' | 'gerente' | 'admin'
          id?: string
          nome: string
          push_token?: string | null
          restaurante_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          auth_user_id?: string | null
          criado_em?: string
          funcao?: 'garcom' | 'mesero' | 'gerente' | 'admin'
          id?: string
          nome?: string
          push_token?: string | null
          restaurante_id?: string
        }
      }
    }
    Functions: {
      comanda_stats: {
        Args: { p_restaurante_id: string }
        Returns: Json
      }
    }
    Enums: {
      comanda_mesa_status: 'disponivel' | 'ocupada' | 'reservada' | 'limpeza'
      comanda_pedido_status: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
      comanda_usuario_funcao: 'garcom' | 'mesero' | 'gerente' | 'admin'
    }
    Views: Record<string, never>
  }
}

// ── Atalhos de tipos para uso no app ──────────────────────────────────────────

export type Mesa     = Database['public']['Tables']['comanda_mesas']['Row']
export type Pedido   = Database['public']['Tables']['comanda_pedidos']['Row']
export type ItemPedido = Database['public']['Tables']['comanda_itens_pedido']['Row']
export type Produto  = Database['public']['Tables']['comanda_produtos']['Row']
export type Categoria = Database['public']['Tables']['comanda_categorias']['Row']
export type Cliente  = Database['public']['Tables']['comanda_clientes']['Row']
export type Usuario  = Database['public']['Tables']['comanda_usuarios']['Row']
export type Restaurante = Database['public']['Tables']['comanda_restaurantes']['Row']

export type MesaStatus   = 'disponivel' | 'ocupada' | 'reservada' | 'limpeza'
export type PedidoStatus = 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
export type UsuarioFuncao = 'garcom' | 'mesero' | 'gerente' | 'admin'

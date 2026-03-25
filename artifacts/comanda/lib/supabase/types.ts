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
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
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
        Relationships: [
          {
            foreignKeyName: "comanda_categorias_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "comanda_clientes_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_convites: {
        Row: {
          codigo: string
          criado_em: string | null
          expira_em: string | null
          funcao: string | null
          id: string
          restaurante_id: string | null
          usado: boolean | null
        }
        Insert: {
          codigo: string
          criado_em?: string | null
          expira_em?: string | null
          funcao?: string | null
          id?: string
          restaurante_id?: string | null
          usado?: boolean | null
        }
        Update: {
          codigo?: string
          criado_em?: string | null
          expira_em?: string | null
          funcao?: string | null
          id?: string
          restaurante_id?: string | null
          usado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "comanda_convites_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
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
          restaurante_id: string | null
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
          restaurante_id?: string | null
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
          restaurante_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "comanda_itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "comanda_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "comanda_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_pedido_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
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
          status: Database["public"]["Enums"]["comanda_mesa_status"]
        }
        Insert: {
          atualizado_em?: string
          capacidade?: number
          criado_em?: string
          id?: string
          nome_cliente?: string | null
          numero: number
          restaurante_id: string
          status?: Database["public"]["Enums"]["comanda_mesa_status"]
        }
        Update: {
          atualizado_em?: string
          capacidade?: number
          criado_em?: string
          id?: string
          nome_cliente?: string | null
          numero?: number
          restaurante_id?: string
          status?: Database["public"]["Enums"]["comanda_mesa_status"]
        }
        Relationships: [
          {
            foreignKeyName: "comanda_mesas_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_pedidos: {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          cliente_id: string | null
          criado_em: string
          garcom_id: string | null
          id: string
          mesa_id: string | null
          motivo_cancelamento: string | null
          observacoes: string | null
          preparando_em: string | null
          pronto_em: string | null
          restaurante_id: string
          status: Database["public"]["Enums"]["comanda_pedido_status"]
          total: number
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          cliente_id?: string | null
          criado_em?: string
          garcom_id?: string | null
          id?: string
          mesa_id?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          preparando_em?: string | null
          pronto_em?: string | null
          restaurante_id: string
          status?: Database["public"]["Enums"]["comanda_pedido_status"]
          total?: number
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          cliente_id?: string | null
          criado_em?: string
          garcom_id?: string | null
          id?: string
          mesa_id?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          preparando_em?: string | null
          pronto_em?: string | null
          restaurante_id?: string
          status?: Database["public"]["Enums"]["comanda_pedido_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "comanda_pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "comanda_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_pedidos_garcom_id_fkey"
            columns: ["garcom_id"]
            isOneToOne: false
            referencedRelation: "comanda_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_pedidos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "comanda_mesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_pedidos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "comanda_produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "comanda_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_produtos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_restaurantes: {
        Row: {
          atualizado_em: string
          criado_em: string
          endereco: string | null
          id: string
          nit: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nit?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nit?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      comanda_usuarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          auth_user_id: string | null
          criado_em: string
          funcao: Database["public"]["Enums"]["comanda_usuario_funcao"]
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
          funcao?: Database["public"]["Enums"]["comanda_usuario_funcao"]
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
          funcao?: Database["public"]["Enums"]["comanda_usuario_funcao"]
          id?: string
          nome?: string
          push_token?: string | null
          restaurante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_usuarios_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "comanda_restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      comanda_stats: { Args: { p_restaurante_id: string }; Returns: Json }
      get_my_restaurante_id: { Args: never; Returns: string }
      get_my_restaurante_id_safe: { Args: never; Returns: string }
    }
    Enums: {
      comanda_mesa_status: "disponivel" | "ocupada" | "reservada" | "limpeza"
      comanda_pedido_status:
        | "pendente"
        | "preparando"
        | "pronto"
        | "entregue"
        | "cancelado"
      comanda_usuario_funcao: "garcom" | "gerente" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
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

export type MesaStatus   = Database['public']['Enums']['comanda_mesa_status']
export type PedidoStatus = Database['public']['Enums']['comanda_pedido_status']
export type UsuarioFuncao = Database['public']['Enums']['comanda_usuario_funcao']

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
      _lint_backups: {
        Row: {
          created_at: string | null
          ddl: string
          id: number
          object_name: string
          object_schema: string
          object_type: string
        }
        Insert: {
          created_at?: string | null
          ddl: string
          id?: number
          object_name: string
          object_schema: string
          object_type: string
        }
        Update: {
          created_at?: string | null
          ddl?: string
          id?: number
          object_name?: string
          object_schema?: string
          object_type?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          created_at: string | null
          error_message: string | null
          failed_records: number | null
          file_name: string
          file_type: string | null
          id: string
          imported_by: string | null
          status: string | null
          successful_records: number | null
          total_records: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          failed_records?: number | null
          file_name: string
          file_type?: string | null
          id?: string
          imported_by?: string | null
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          failed_records?: number | null
          file_name?: string
          file_type?: string | null
          id?: string
          imported_by?: string | null
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          banco: string | null
          cbo: string | null
          cbo_block_code: string | null
          cbo_block_name: string | null
          cpf: string
          created_at: string | null
          data_envio: string | null
          data_retorno: string | null
          id: string
          import_batch_id: string | null
          imported_by: string | null
          nome: string | null
          observacoes: string | null
          retorno_autorizacao: Json | null
          retorno_get_proposta: Json | null
          retorno_margem: Json | null
          retorno_proposta: Json | null
          retorno_simulacao: Json | null
          status: string | null
          tipo_reprovacao: string | null
          ultimo_log: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          banco?: string | null
          cbo?: string | null
          cbo_block_code?: string | null
          cbo_block_name?: string | null
          cpf: string
          created_at?: string | null
          data_envio?: string | null
          data_retorno?: string | null
          id?: string
          import_batch_id?: string | null
          imported_by?: string | null
          nome?: string | null
          observacoes?: string | null
          retorno_autorizacao?: Json | null
          retorno_get_proposta?: Json | null
          retorno_margem?: Json | null
          retorno_proposta?: Json | null
          retorno_simulacao?: Json | null
          status?: string | null
          tipo_reprovacao?: string | null
          ultimo_log?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          banco?: string | null
          cbo?: string | null
          cbo_block_code?: string | null
          cbo_block_name?: string | null
          cpf?: string
          created_at?: string | null
          data_envio?: string | null
          data_retorno?: string | null
          id?: string
          import_batch_id?: string | null
          imported_by?: string | null
          nome?: string | null
          observacoes?: string | null
          retorno_autorizacao?: Json | null
          retorno_get_proposta?: Json | null
          retorno_margem?: Json | null
          retorno_proposta?: Json | null
          retorno_simulacao?: Json | null
          status?: string | null
          tipo_reprovacao?: string | null
          ultimo_log?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leads_com_motivo: {
        Row: {
          banco: string | null
          cbo: string | null
          cbo_block_code: string | null
          cbo_block_name: string | null
          cpf: string | null
          created_at: string | null
          data_envio: string | null
          data_retorno: string | null
          id: string | null
          import_batch_id: string | null
          imported_by: string | null
          motivo_reprovacao_tecnica: string | null
          nome: string | null
          observacoes: string | null
          retorno_autorizacao: Json | null
          retorno_get_proposta: Json | null
          retorno_margem: Json | null
          retorno_proposta: Json | null
          retorno_simulacao: Json | null
          status: string | null
          tipo_reprovacao: string | null
          ultimo_log: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          banco?: string | null
          cbo?: string | null
          cbo_block_code?: string | null
          cbo_block_name?: string | null
          cpf?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_retorno?: string | null
          id?: string | null
          import_batch_id?: string | null
          imported_by?: string | null
          motivo_reprovacao_tecnica?: never
          nome?: string | null
          observacoes?: string | null
          retorno_autorizacao?: Json | null
          retorno_get_proposta?: Json | null
          retorno_margem?: Json | null
          retorno_proposta?: Json | null
          retorno_simulacao?: Json | null
          status?: string | null
          tipo_reprovacao?: string | null
          ultimo_log?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          banco?: string | null
          cbo?: string | null
          cbo_block_code?: string | null
          cbo_block_name?: string | null
          cpf?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_retorno?: string | null
          id?: string | null
          import_batch_id?: string | null
          imported_by?: string | null
          motivo_reprovacao_tecnica?: never
          nome?: string | null
          observacoes?: string | null
          retorno_autorizacao?: Json | null
          retorno_get_proposta?: Json | null
          retorno_margem?: Json | null
          retorno_proposta?: Json | null
          retorno_simulacao?: Json | null
          status?: string | null
          tipo_reprovacao?: string | null
          ultimo_log?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      count_leads: {
        Args: {
          p_banco?: string
          p_cpf?: string
          p_data_final?: string
          p_data_inicial?: string
          p_status?: string
          p_tipo_reprovacao?: string
        }
        Returns: number
      }
      extract_message_errors: { Args: { margem: Json }; Returns: string }
      extract_motivo_prioritario: { Args: { margem: Json }; Returns: string }
      get_cbos_por_banco: {
        Args: { p_import_batch_id?: string }
        Returns: {
          banco: string
          cbo_codigo: string
          cbo_nome: string
          quantidade: number
        }[]
      }
      get_dashboard_analytics: {
        Args: {
          p_data_inicial?: string
          p_data_final?: string
          p_banco?: string
          p_import_batch_id?: string
        }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: {
          p_banco?: string
          p_data_final?: string
          p_data_inicial?: string
          p_import_batch_id?: string
          p_status?: string
        }
        Returns: Json
      }
      get_empresas_por_banco: {
        Args: { p_import_batch_id?: string }
        Returns: {
          banco: string
          empresa_nome: string
          quantidade: number
        }[]
      }
      get_erros_consultas_analysis: {
        Args: { p_banco?: string; p_import_batch_id?: string }
        Returns: {
          banco: string
          categoria_erro: string
          percentual: number
          quantidade: number
          tipo_erro: string
        }[]
      }
      get_erros_por_banco: {
        Args: { p_import_batch_id?: string }
        Returns: {
          banco: string
          erro_mais_comum: string
          erro_mais_comum_qtd: number
          taxa_erro: number
          total_consultas: number
          total_erros: number
        }[]
      }
      get_erros_resumo: {
        Args: { p_banco?: string; p_import_batch_id?: string }
        Returns: {
          categoria_mais_comum: string
          categoria_mais_comum_qtd: number
          erro_mais_comum: string
          erro_mais_comum_qtd: number
          erro_menos_comum: string
          erro_menos_comum_qtd: number
          taxa_erro: number
          total_aprovados: number
          total_consultas: number
          total_erros: number
        }[]
      }
      get_filter_options: { Args: Record<string, never>; Returns: Json }
      get_leads_analysis: {
        Args: { p_banco?: string; p_import_batch_id?: string }
        Returns: Json
      }
      get_leads_by_banco: {
        Args: {
          p_banco: string
          p_import_batch_id?: string
          p_limit?: number
          p_status?: string
        }
        Returns: Json
      }
      get_leads_by_cbo: {
        Args: {
          p_cbo_codigo: string
          p_import_batch_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      get_leads_by_empresa: {
        Args: {
          p_empresa_nome: string
          p_import_batch_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      get_leads_by_faixa_margem: {
        Args: { p_faixa: string; p_import_batch_id?: string; p_limit?: number }
        Returns: Json
      }
      get_leads_by_margem_status: {
        Args: {
          p_import_batch_id?: string
          p_limit?: number
          p_tem_margem: boolean
        }
        Returns: {
          banco: string
          cpf: string
          margem: number
          nome: string
          parcelas: number
          produto: string
          status: string
        }[]
      }
      get_leads_by_parcelas: {
        Args: {
          p_import_batch_id?: string
          p_limit?: number
          p_parcelas: number
        }
        Returns: {
          banco: string
          cpf: string
          margem: number
          nome: string
          parcelas: number
          produto: string
          status: string
        }[]
      }
      get_leads_by_porte: {
        Args: { p_limit?: number; p_porte: string }
        Returns: Json
      }
      get_leads_by_produto: {
        Args: {
          p_import_batch_id?: string
          p_limit?: number
          p_produto: string
        }
        Returns: {
          banco: string
          cpf: string
          margem: number
          nome: string
          parcelas: number
          produto: string
          status: string
        }[]
      }
      get_leads_by_simulacao_status: {
        Args: {
          p_aprovada: boolean
          p_import_batch_id?: string
          p_limit?: number
        }
        Returns: {
          banco: string
          cpf: string
          margem: number
          nome: string
          parcelas: number
          produto: string
          status: string
        }[]
      }
      get_leads_by_vinculo: {
        Args: { p_faixa: string; p_import_batch_id?: string; p_limit?: number }
        Returns: Json
      }
      get_leads_stats: { Args: Record<string, never>; Returns: Json }
      get_leads_with_motivo: {
        Args: {
          p_banco?: string
          p_cpf?: string
          p_import_batch_id?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          banco: string
          cpf: string
          created_at: string
          id: string
          import_batch_id: string
          motivo_reprovacao_tecnica: string
          nome: string
          retorno_get_proposta: Json
          status: string
          tipo_reprovacao: string
          valor: number
        }[]
      }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_lead_aprovado: {
        Args: { p_retorno_get_proposta: Json; p_status: string }
        Returns: boolean
      }
      is_lead_pago: { Args: { p_retorno_get_proposta: Json }; Returns: boolean }
      is_lead_reprovado: { Args: { p_status: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          details: Json
          id: string
          target_email: string
        }
        Insert: {
          action: string
          admin_email?: string
          created_at?: string
          details?: Json
          id?: string
          target_email?: string
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          details?: Json
          id?: string
          target_email?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          id: string
          storage_path: string
          title: string
          uploaded_at: string
        }
        Insert: {
          client_id: string
          id?: string
          storage_path: string
          title: string
          uploaded_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          storage_path?: string
          title?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          notes: string
          updated_at: string
        }
        Insert: {
          client_id: string
          notes?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          agreement_date: string | null
          booking_date: string | null
          created_at: string
          email: string
          flat_no: string
          floor: string
          full_name: string
          id: string
          is_demo: boolean
          parking: boolean
          payment_plan_note: string
          phone: string
          profile_id: string | null
          project_id: string | null
          size_sft: number | null
          status: string
          total_price: number
          updated_at: string
        }
        Insert: {
          address?: string
          agreement_date?: string | null
          booking_date?: string | null
          created_at?: string
          email?: string
          flat_no?: string
          floor?: string
          full_name: string
          id?: string
          is_demo?: boolean
          parking?: boolean
          payment_plan_note?: string
          phone?: string
          profile_id?: string | null
          project_id?: string | null
          size_sft?: number | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Update: {
          address?: string
          agreement_date?: string | null
          booking_date?: string | null
          created_at?: string
          email?: string
          flat_no?: string
          floor?: string
          full_name?: string
          id?: string
          is_demo?: boolean
          parking?: boolean
          payment_plan_note?: string
          phone?: string
          profile_id?: string | null
          project_id?: string | null
          size_sft?: number | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_items: {
        Row: {
          category: string
          id: string
          name: string
          progress_pct: number
          project_id: string
          sort_order: number
          status: string
        }
        Insert: {
          category: string
          id?: string
          name: string
          progress_pct?: number
          project_id: string
          sort_order?: number
          status?: string
        }
        Update: {
          category?: string
          id?: string
          name?: string
          progress_pct?: number
          project_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_subscribers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_subscribers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_update_media: {
        Row: {
          id: string
          media_id: string
          sort_order: number
          update_id: string
        }
        Insert: {
          id?: string
          media_id: string
          sort_order?: number
          update_id: string
        }
        Update: {
          id?: string
          media_id?: string
          sort_order?: number
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_update_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_update_media_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "construction_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_updates: {
        Row: {
          created_at: string
          id: string
          month: string
          note: string
          project_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          note?: string
          project_id: string
          sort_order?: number
          title?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          note?: string
          project_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          message: string
          phone: string
          read_at: string | null
          service: string | null
          status: string
          subject: string
          user_id: string | null
          visit_date: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          message: string
          phone: string
          read_at?: string | null
          service?: string | null
          status?: string
          subject?: string
          user_id?: string | null
          visit_date?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          message?: string
          phone?: string
          read_at?: string | null
          service?: string | null
          status?: string
          subject?: string
          user_id?: string | null
          visit_date?: string | null
        }
        Relationships: []
      }
      instalments: {
        Row: {
          amount: number
          client_id: string
          due_date: string
          id: string
          label: string
          paid_amount: number
          status: string
        }
        Insert: {
          amount: number
          client_id: string
          due_date: string
          id?: string
          label?: string
          paid_amount?: number
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string
          due_date?: string
          id?: string
          label?: string
          paid_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "instalments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          id: number
          identifier: string
        }
        Insert: {
          created_at?: string
          id?: number
          identifier: string
        }
        Update: {
          created_at?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          alt_text: string
          caption: string
          created_at: string
          file_name: string
          height: number | null
          id: string
          project_id: string | null
          public_url: string
          size_bytes: number | null
          sort_order: number
          storage_path: string | null
          title: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          caption?: string
          created_at?: string
          file_name?: string
          height?: number | null
          id?: string
          project_id?: string | null
          public_url: string
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string | null
          title?: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          caption?: string
          created_at?: string
          file_name?: string
          height?: number | null
          id?: string
          project_id?: string | null
          public_url?: string
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string | null
          title?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          method: string
          note: string
          paid_on: string
          recorded_by: string | null
          reference: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          method?: string
          note?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          method?: string
          note?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          must_change_password: boolean
          phone: string
          status: string
          username: string | null
        }
        Insert: {
          account_type?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          last_seen_at?: string | null
          must_change_password?: boolean
          phone?: string
          status?: string
          username?: string | null
        }
        Update: {
          account_type?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          must_change_password?: boolean
          phone?: string
          status?: string
          username?: string | null
        }
        Relationships: []
      }
      project_stages: {
        Row: {
          completed_on: string | null
          id: string
          note: string
          project_id: string
          sort_order: number
          stage: string
          status: string
        }
        Insert: {
          completed_on?: string | null
          id?: string
          note?: string
          project_id: string
          sort_order?: number
          stage: string
          status?: string
        }
        Update: {
          completed_on?: string | null
          id?: string
          note?: string
          project_id?: string
          sort_order?: number
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_units: {
        Row: {
          balconies: number | null
          bathrooms: number | null
          bedrooms: number | null
          id: string
          label: string
          note: string
          project_id: string
          size_sqft: number | null
          sort_order: number
        }
        Insert: {
          balconies?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          id?: string
          label?: string
          note?: string
          project_id: string
          size_sqft?: number | null
          sort_order?: number
        }
        Update: {
          balconies?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          id?: string
          label?: string
          note?: string
          project_id?: string
          size_sqft?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string
          availability: string
          building_type: string
          cover_media_id: string | null
          created_at: string
          description: string
          expected_completion: string
          features: string[]
          flat_sizes: string
          handover_date: string
          id: string
          kind: string
          location_short: string
          map_url: string
          name: string
          progress_pct: number
          project_no: string
          published: boolean
          slug: string
          sort_order: number
          status: string
          status_details_published: boolean
          status_updated_at: string | null
          total_flats: number | null
          total_floors: number | null
          units_per_floor: number | null
          updated_at: string
        }
        Insert: {
          address?: string
          availability?: string
          building_type?: string
          cover_media_id?: string | null
          created_at?: string
          description?: string
          expected_completion?: string
          features?: string[]
          flat_sizes?: string
          handover_date?: string
          id?: string
          kind?: string
          location_short?: string
          map_url?: string
          name: string
          progress_pct?: number
          project_no?: string
          published?: boolean
          slug: string
          sort_order?: number
          status?: string
          status_details_published?: boolean
          status_updated_at?: string | null
          total_flats?: number | null
          total_floors?: number | null
          units_per_floor?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          availability?: string
          building_type?: string
          cover_media_id?: string | null
          created_at?: string
          description?: string
          expected_completion?: string
          features?: string[]
          flat_sizes?: string
          handover_date?: string
          id?: string
          kind?: string
          location_short?: string
          map_url?: string
          name?: string
          progress_pct?: number
          project_no?: string
          published?: boolean
          slug?: string
          sort_order?: number
          status?: string
          status_details_published?: boolean
          status_updated_at?: string | null
          total_flats?: number | null
          total_floors?: number | null
          units_per_floor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_media_fk"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_projects: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          id: string
          provider: string
          published: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          url: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          url: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          url?: string
          video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      client_balances: {
        Row: {
          amount_due: number | null
          client_id: string | null
          last_payment_amount: number | null
          last_payment_on: string | null
          next_due_amount: number | null
          next_due_date: string | null
          overdue_amount: number | null
          pct_paid: number | null
          total_paid: number | null
          total_price: number | null
        }
        Relationships: []
      }
      instalments_live: {
        Row: {
          amount: number | null
          client_id: string | null
          due_date: string | null
          id: string | null
          label: string | null
          paid_amount: number | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          due_date?: string | null
          id?: string | null
          label?: string | null
          paid_amount?: number | null
          status?: never
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          due_date?: string | null
          id?: string | null
          label?: string | null
          paid_amount?: number | null
          status?: never
        }
        Relationships: [
          {
            foreignKeyName: "instalments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "instalments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_accounts: {
        Args: never
        Returns: {
          account_type: string
          created_at: string
          email: string
          email_verified: boolean
          full_name: string
          id: string
          last_seen_at: string
          phone: string
          status: string
        }[]
      }
      admin_emails: { Args: never; Returns: string[] }
      admin_reallocate_payments: {
        Args: { _client_id: string }
        Returns: undefined
      }
      admin_revoke_sessions: { Args: { _uid: string }; Returns: undefined }
      admin_save_client: {
        Args: {
          _changes: Json
          _client: Json
          _client_id: string
          _notes: string
          _rows: Json
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_my_client: { Args: { _client_id: string }; Returns: boolean }
      normalize_bd_phone: { Args: { _p: string }; Returns: string }
      phone_available: { Args: { _p: string }; Returns: boolean }
      unique_username: { Args: { _base: string }; Returns: string }
      username_available: { Args: { _u: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

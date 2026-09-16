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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_meta: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string
          branch_id: string | null
          created_at: string
          id: number
          reason: string | null
          resource_id: string
          resource_type: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_profile_id: string
          branch_id?: string | null
          created_at?: string
          id?: never
          reason?: string | null
          resource_id: string
          resource_type: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string
          branch_id?: string | null
          created_at?: string
          id?: never
          reason?: string | null
          resource_id?: string
          resource_type?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      branch_working_hours: {
        Row: {
          branch_id: string
          close_time: string
          created_at: string
          end_minute: number | null
          id: string
          open_time: string
          restaurant_id: string
          start_minute: number | null
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          branch_id: string
          close_time: string
          created_at?: string
          end_minute?: number | null
          id?: string
          open_time: string
          restaurant_id: string
          start_minute?: number | null
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          branch_id?: string
          close_time?: string
          created_at?: string
          end_minute?: number | null
          id?: string
          open_time?: string
          restaurant_id?: string
          start_minute?: number | null
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: [
          {
            foreignKeyName: "branch_working_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_working_hours_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_tables_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string
          id: string
          is_super_admin: boolean
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_super_admin?: boolean
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_super_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          brand_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_memberships: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          profile_id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_staff_member: {
        Args: {
          p_branch_id?: string
          p_display_name: string
          p_email: string
          p_restaurant_id: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: Json
      }
      create_branch: {
        Args: { p_name: string; p_restaurant_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_dining_table: {
        Args: { p_branch_id: string; p_label: string }
        Returns: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          restaurant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dining_tables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_restaurant: {
        Args: {
          p_brand_description?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_name: string
          p_slug: string
          p_timezone?: string
        }
        Returns: {
          brand_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_auth_context: { Args: never; Returns: Json }
      remove_staff_membership: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      rename_branch: {
        Args: { p_branch_id: string; p_name: string }
        Returns: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rename_dining_table: {
        Args: { p_dining_table_id: string; p_label: string }
        Returns: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          restaurant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dining_tables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_branch_working_hours: {
        Args: { p_branch_id: string; p_intervals: Json }
        Returns: {
          branch_id: string
          close_time: string
          created_at: string
          end_minute: number | null
          id: string
          open_time: string
          restaurant_id: string
          start_minute: number | null
          weekday: Database["public"]["Enums"]["weekday"]
        }[]
        SetofOptions: {
          from: "*"
          to: "branch_working_hours"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_dining_table_active: {
        Args: { p_active: boolean; p_dining_table_id: string }
        Returns: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          restaurant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "dining_tables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_restaurant_profile: {
        Args: {
          p_brand_description?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_name: string
          p_restaurant_id: string
          p_slug: string
        }
        Returns: {
          brand_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_restaurant_settings: {
        Args: { p_restaurant_id: string; p_timezone: string }
        Returns: {
          brand_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_staff_membership: {
        Args: {
          p_branch_id?: string
          p_membership_id: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: {
          branch_id: string | null
          created_at: string
          id: string
          profile_id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        SetofOptions: {
          from: "*"
          to: "staff_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      staff_role: "owner" | "branch_manager" | "cashier" | "kitchen"
      weekday:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
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
    Enums: {
      staff_role: ["owner", "branch_manager", "cashier", "kitchen"],
      weekday: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const

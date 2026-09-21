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
      branch_tax_overrides: {
        Row: {
          branch_id: string
          created_at: string
          rate: number
          restaurant_id: string
          rule_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          rate: number
          restaurant_id: string
          rule_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          rate?: number
          restaurant_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_tax_overrides_branch_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "branch_tax_overrides_rule_scope_fkey"
            columns: ["restaurant_id", "rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      branch_unavailable_items: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          item_id: string
          restaurant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          item_id: string
          restaurant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          item_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_unavailable_items_item_scope_fkey"
            columns: ["restaurant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "branch_unavailable_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_unavailable_items_scope_fkey"
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
      kitchen_tickets: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          restaurant_id: string
          round_id: string
          state: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          round_id: string
          state?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          round_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_branch_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "kitchen_tickets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_tickets_round_scope_fkey"
            columns: ["restaurant_id", "round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_extras: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name: string
          price_adjustment: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name: string
          price_adjustment?: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          price_adjustment?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_extras_item_scope_fkey"
            columns: ["restaurant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "menu_item_extras_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_scope_fkey"
            columns: ["restaurant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
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
      round_item_extras: {
        Row: {
          created_at: string
          extra_id: string
          id: string
          price_adjustment: number
          restaurant_id: string
          round_item_id: string
        }
        Insert: {
          created_at?: string
          extra_id: string
          id?: string
          price_adjustment: number
          restaurant_id: string
          round_item_id: string
        }
        Update: {
          created_at?: string
          extra_id?: string
          id?: string
          price_adjustment?: number
          restaurant_id?: string
          round_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_item_extras_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "menu_item_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_item_extras_line_scope_fkey"
            columns: ["restaurant_id", "round_item_id"]
            isOneToOne: false
            referencedRelation: "round_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "round_item_extras_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      round_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          restaurant_id: string
          round_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          restaurant_id: string
          round_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          restaurant_id?: string
          round_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_items_item_scope_fkey"
            columns: ["restaurant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "round_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_items_round_scope_fkey"
            columns: ["restaurant_id", "round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      rounds: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          restaurant_id: string
          session_id: string
          state: string
          subtotal: number
          tax_lines: Json
          tax_total: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          session_id: string
          state?: string
          subtotal: number
          tax_lines?: Json
          tax_total: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          session_id?: string
          state?: string
          subtotal?: number
          tax_lines?: Json
          tax_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_branch_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "rounds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          created_at: string
          display_name: string
          id: string
          joined_at: string
          phone: string
          restaurant_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          joined_at?: string
          phone: string
          restaurant_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          joined_at?: string
          phone?: string
          restaurant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_restaurant_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_tokens: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          session_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          session_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          session_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by_profile_id: string | null
          created_at: string
          delivery_address: string | null
          id: string
          opened_at: string
          restaurant_id: string
          status: string
          table_id: string | null
          type: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by_profile_id?: string | null
          created_at?: string
          delivery_address?: string | null
          id?: string
          opened_at?: string
          restaurant_id: string
          status?: string
          table_id?: string | null
          type?: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by_profile_id?: string | null
          created_at?: string
          delivery_address?: string | null
          id?: string
          opened_at?: string
          restaurant_id?: string
          status?: string
          table_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_branch_scope_fkey"
            columns: ["restaurant_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "sessions_closed_by_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_table_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
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
      tax_rule_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          restaurant_id: string
          rule_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          rule_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rule_categories_category_scope_fkey"
            columns: ["restaurant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "tax_rule_categories_scope_fkey"
            columns: ["restaurant_id", "rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      tax_rule_compounds: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          rule_id: string
          source_rule_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          rule_id: string
          source_rule_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          rule_id?: string
          source_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rule_compounds_scope_fkey"
            columns: ["restaurant_id", "rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "tax_rule_compounds_source_scope_fkey"
            columns: ["restaurant_id", "source_rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      tax_rule_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          restaurant_id: string
          rule_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          restaurant_id: string
          rule_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          restaurant_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rule_items_item_scope_fkey"
            columns: ["restaurant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "tax_rule_items_scope_fkey"
            columns: ["restaurant_id", "rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      tax_rules: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate: number
          restaurant_id: string
          scope: string
          sort_order: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rate?: number
          restaurant_id: string
          scope: string
          sort_order?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
          restaurant_id?: string
          scope?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_snapshots: {
        Row: {
          branch_id: string
          created_at: string
          fingerprint: string
          id: string
          payload: Json
          recorded_at: string | null
          restaurant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          fingerprint: string
          id?: string
          payload: Json
          recorded_at?: string | null
          restaurant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          fingerprint?: string
          id?: string
          payload?: Json
          recorded_at?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_round: { Args: { p_round_id: string }; Returns: Json }
      add_menu_item_extra: {
        Args: { p_item_id: string; p_name: string; p_price_adjustment?: number }
        Returns: {
          created_at: string
          id: string
          item_id: string
          name: string
          price_adjustment: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_item_extras"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      calculate_branch_taxes: {
        Args: { p_branch_id: string; p_selections: Json }
        Returns: Json
      }
      close_session: { Args: { p_session_id: string }; Returns: Json }
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
      create_menu_category: {
        Args: {
          p_description?: string
          p_name: string
          p_restaurant_id: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_menu_item: {
        Args: {
          p_category_id: string
          p_description?: string
          p_name: string
          p_price?: number
        }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_items"
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
      create_tax_rule: {
        Args: {
          p_branch_id?: string
          p_category_ids?: string[]
          p_compound_source_ids?: string[]
          p_item_ids?: string[]
          p_name: string
          p_rate: string
          p_restaurant_id: string
          p_scope: string
          p_sort_order?: number
        }
        Returns: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate: number
          restaurant_id: string
          scope: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "tax_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_auth_context: { Args: never; Returns: Json }
      delete_menu_category: {
        Args: { p_category_id: string }
        Returns: undefined
      }
      delete_unused_tax_rule: {
        Args: { p_rule_id: string }
        Returns: undefined
      }
      get_branch_menu: { Args: { p_branch_id: string }; Returns: Json }
      get_branch_open_sessions: { Args: { p_branch_id: string }; Returns: Json }
      get_branch_rounds: { Args: { p_branch_id: string }; Returns: Json }
      get_branch_tax_config: { Args: { p_branch_id: string }; Returns: Json }
      get_kitchen_queue: { Args: { p_branch_id: string }; Returns: Json }
      get_public_restaurant: { Args: { p_slug: string }; Returns: Json }
      get_session_bill: { Args: { p_session_id: string }; Returns: Json }
      get_session_context: { Args: { p_token: string }; Returns: Json }
      get_session_menu: { Args: { p_token: string }; Returns: Json }
      get_session_rounds: { Args: { p_token: string }; Returns: Json }
      lock_round: { Args: { p_round_id: string }; Returns: Json }
      mark_completed: { Args: { p_round_id: string }; Returns: Json }
      mark_out_for_delivery: { Args: { p_round_id: string }; Returns: Json }
      mark_round_ready: { Args: { p_round_id: string }; Returns: Json }
      modify_round_line: {
        Args: {
          p_action: string
          p_item_id: string
          p_quantity?: number
          p_round_id: string
        }
        Returns: Json
      }
      move_menu_item: {
        Args: { p_category_id: string; p_item_id: string }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      open_session_at_table: {
        Args: {
          p_branch_id: string
          p_display_name: string
          p_phone: string
          p_restaurant_id: string
          p_table_id: string
        }
        Returns: Json
      }
      open_session_channel: {
        Args: {
          p_branch_id: string
          p_channel: string
          p_delivery_address?: string
          p_display_name: string
          p_phone: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      record_tax_snapshot: {
        Args: {
          p_branch_id: string
          p_fingerprint: string
          p_payload: Json
          p_restaurant_id: string
        }
        Returns: Json
      }
      remove_menu_item_extra: {
        Args: { p_extra_id: string }
        Returns: undefined
      }
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
      reorder_menu_categories: {
        Args: { p_category_ids: string[]; p_restaurant_id: string }
        Returns: undefined
      }
      reorder_menu_items: {
        Args: { p_category_id: string; p_item_ids: string[] }
        Returns: undefined
      }
      reorder_tax_rules: {
        Args: {
          p_branch_id?: string
          p_restaurant_id: string
          p_rule_ids: string[]
        }
        Returns: undefined
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
      retire_tax_rule: {
        Args: { p_active?: boolean; p_rule_id: string }
        Returns: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate: number
          restaurant_id: string
          scope: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "tax_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_branch_item_availability: {
        Args: {
          p_branch_id: string
          p_is_available_at_branch: boolean
          p_item_id: string
        }
        Returns: boolean
      }
      set_branch_tax_override: {
        Args: { p_branch_id: string; p_rate: string; p_rule_id: string }
        Returns: Json
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
      set_menu_item_availability: {
        Args: { p_is_available: boolean; p_item_id: string }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_menu_item_image: {
        Args: { p_image_path: string; p_item_id: string }
        Returns: string
      }
      start_preparation: { Args: { p_round_id: string }; Returns: Json }
      submit_round: { Args: { p_items: Json; p_token: string }; Returns: Json }
      update_menu_category: {
        Args: { p_category_id: string; p_description?: string; p_name: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_menu_item: {
        Args: {
          p_description?: string
          p_item_id: string
          p_name: string
          p_price?: number
        }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_menu_item_extra: {
        Args: {
          p_extra_id: string
          p_name: string
          p_price_adjustment?: number
        }
        Returns: {
          created_at: string
          id: string
          item_id: string
          name: string
          price_adjustment: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_item_extras"
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
      update_tax_rule: {
        Args: {
          p_category_ids?: string[]
          p_compound_source_ids?: string[]
          p_item_ids?: string[]
          p_name: string
          p_rate: string
          p_rule_id: string
          p_scope: string
          p_sort_order: number
        }
        Returns: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate: number
          restaurant_id: string
          scope: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "tax_rules"
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

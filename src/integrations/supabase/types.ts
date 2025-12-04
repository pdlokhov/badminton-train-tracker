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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_daily: {
        Row: {
          avg_session_duration: number | null
          bounce_rate: number | null
          created_at: string
          date: string
          device_breakdown: Json | null
          id: string
          new_visitors: number | null
          page_views: number | null
          peak_hours: Json | null
          popular_channels: Json | null
          popular_levels: Json | null
          popular_types: Json | null
          retention_d1: number | null
          retention_d30: number | null
          retention_d7: number | null
          returning_visitors: number | null
          search_queries: Json | null
          telegram_clicks: number | null
          training_views: Json | null
          unique_visitors: number | null
          updated_at: string
        }
        Insert: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          date: string
          device_breakdown?: Json | null
          id?: string
          new_visitors?: number | null
          page_views?: number | null
          peak_hours?: Json | null
          popular_channels?: Json | null
          popular_levels?: Json | null
          popular_types?: Json | null
          retention_d1?: number | null
          retention_d30?: number | null
          retention_d7?: number | null
          returning_visitors?: number | null
          search_queries?: Json | null
          telegram_clicks?: number | null
          training_views?: Json | null
          unique_visitors?: number | null
          updated_at?: string
        }
        Update: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          date?: string
          device_breakdown?: Json | null
          id?: string
          new_visitors?: number | null
          page_views?: number | null
          peak_hours?: Json | null
          popular_channels?: Json | null
          popular_levels?: Json | null
          popular_types?: Json | null
          retention_d1?: number | null
          retention_d30?: number | null
          retention_d7?: number | null
          returning_visitors?: number | null
          search_queries?: Json | null
          telegram_clicks?: number | null
          training_views?: Json | null
          unique_visitors?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          default_coach: string | null
          default_location_id: string | null
          id: string
          is_active: boolean
          name: string
          parse_images: boolean
          topic_id: number | null
          updated_at: string
          url: string
          username: string
        }
        Insert: {
          created_at?: string
          default_coach?: string | null
          default_location_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          parse_images?: boolean
          topic_id?: number | null
          updated_at?: string
          url: string
          username: string
        }
        Update: {
          created_at?: string
          default_coach?: string | null
          default_location_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parse_images?: boolean
          topic_id?: number | null
          updated_at?: string
          url?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      disclaimer_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          visitor_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          visitor_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          aliases: string[] | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          aliases?: string[] | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          aliases?: string[] | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      processed_images: {
        Row: {
          channel_id: string
          id: string
          image_url: string
          message_id: string
          processed_at: string
          trainings_count: number | null
        }
        Insert: {
          channel_id: string
          id?: string
          image_url: string
          message_id: string
          processed_at?: string
          trainings_count?: number | null
        }
        Update: {
          channel_id?: string
          id?: string
          image_url?: string
          message_id?: string
          processed_at?: string
          trainings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_images_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          channel_id: string
          coach: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          level: string | null
          location: string | null
          location_id: string | null
          message_id: string
          price: number | null
          raw_text: string
          recurrence_day_of_week: number | null
          recurring_template_id: string | null
          recurring_until: string | null
          signup_url: string | null
          spots: number | null
          time_end: string | null
          time_start: string | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          coach?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          level?: string | null
          location?: string | null
          location_id?: string | null
          message_id: string
          price?: number | null
          raw_text: string
          recurrence_day_of_week?: number | null
          recurring_template_id?: string | null
          recurring_until?: string | null
          signup_url?: string | null
          spots?: number | null
          time_end?: string | null
          time_start?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          coach?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          level?: string | null
          location?: string | null
          location_id?: string | null
          message_id?: string
          price?: number | null
          raw_text?: string
          recurrence_day_of_week?: number | null
          recurring_template_id?: string | null
          recurring_until?: string | null
          signup_url?: string | null
          spots?: number | null
          time_end?: string | null
          time_start?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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

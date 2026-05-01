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
      feature_requests: {
        Row: {
          created_at: string
          id: string
          request_text: string
          status: string
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          request_text: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          request_text?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      mistakes: {
        Row: {
          ayah_number: number
          created_at: string
          id: string
          mistake_category: string | null
          note: string | null
          page_number: number | null
          reciter_id: string
          room_id: string | null
          session_id: string | null
          surah_number: number
          word_index: number
        }
        Insert: {
          ayah_number: number
          created_at?: string
          id?: string
          mistake_category?: string | null
          note?: string | null
          page_number?: number | null
          reciter_id: string
          room_id?: string | null
          session_id?: string | null
          surah_number: number
          word_index: number
        }
        Update: {
          ayah_number?: number
          created_at?: string
          id?: string
          mistake_category?: string | null
          note?: string | null
          page_number?: number | null
          reciter_id?: string
          room_id?: string | null
          session_id?: string | null
          surah_number?: number
          word_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "mistakes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "revision_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "private_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      private_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          current_ayah: number
          current_page: number | null
          ending_ayah: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          session_code: string | null
          session_name: string
          session_ranges: Json | null
          starting_ayah: number
          surah_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_ayah?: number
          current_page?: number | null
          ending_ayah?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          session_code?: string | null
          session_name?: string
          session_ranges?: Json | null
          starting_ayah?: number
          surah_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_ayah?: number
          current_page?: number | null
          ending_ayah?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          session_code?: string | null
          session_name?: string
          session_ranges?: Json | null
          starting_ayah?: number
          surah_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          ayah_number: number
          created_at: string
          id: string
          status: Database["public"]["Enums"]["revision_status"]
          surah_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ayah_number: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["revision_status"]
          surah_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ayah_number?: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["revision_status"]
          surah_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revision_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          message: string | null
          recipient_id: string
          sender_id: string
          status: string
          surah_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          sender_id: string
          status?: string
          surah_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          sender_id?: string
          status?: string
          surah_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      revision_rooms: {
        Row: {
          created_at: string
          created_by: string
          current_ayah: number
          id: string
          is_active: boolean
          name: string
          surah_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_ayah?: number
          id?: string
          is_active?: boolean
          name: string
          surah_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_ayah?: number
          id?: string
          is_active?: boolean
          name?: string
          surah_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["room_role"]
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: Database["public"]["Enums"]["room_role"]
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["room_role"]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "revision_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      session_activity: {
        Row: {
          ayat_revised: number
          completed_at: string
          created_at: string
          ending_ayah: number
          id: string
          mistake_count: number
          role: string
          session_id: string
          started_at: string
          starting_ayah: number
          surah_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ayat_revised?: number
          completed_at?: string
          created_at?: string
          ending_ayah: number
          id?: string
          mistake_count?: number
          role: string
          session_id: string
          started_at: string
          starting_ayah: number
          surah_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ayat_revised?: number
          completed_at?: string
          created_at?: string
          ending_ayah?: number
          id?: string
          mistake_count?: number
          role?: string
          session_id?: string
          started_at?: string
          starting_ayah?: number
          surah_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          has_been_reciter: boolean | null
          id: string
          joined_at: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          has_been_reciter?: boolean | null
          id?: string
          joined_at?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          has_been_reciter?: boolean | null
          id?: string
          joined_at?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "private_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      surah_ratings: {
        Row: {
          created_at: string
          id: string
          rating: string
          surah_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: string
          surah_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: string
          surah_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_old_invites: { Args: never; Returns: undefined }
      generate_session_code: { Args: never; Returns: string }
    }
    Enums: {
      revision_status: "pending" | "revised" | "needsReview"
      room_role: "reciter" | "checker"
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
      revision_status: ["pending", "revised", "needsReview"],
      room_role: ["reciter", "checker"],
    },
  },
} as const

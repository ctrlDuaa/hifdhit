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
      block_ayah_stats: {
        Row: {
          ayah_number: number
          block_id: string
          id: string
          last_reviewed_at: string | null
          strength_score: number
          total_mistakes: number
          total_reviews: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ayah_number: number
          block_id: string
          id?: string
          last_reviewed_at?: string | null
          strength_score?: number
          total_mistakes?: number
          total_reviews?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ayah_number?: number
          block_id?: string
          id?: string
          last_reviewed_at?: string | null
          strength_score?: number
          total_mistakes?: number
          total_reviews?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_ayah_stats_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "memorization_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      block_review_mistakes: {
        Row: {
          ayah_number: number
          block_id: string
          created_at: string
          id: string
          mistake_type: string
          review_id: string
          surah_id: number
          user_id: string
          word_index: number
          word_text: string
        }
        Insert: {
          ayah_number: number
          block_id: string
          created_at?: string
          id?: string
          mistake_type: string
          review_id: string
          surah_id: number
          user_id: string
          word_index: number
          word_text?: string
        }
        Update: {
          ayah_number?: number
          block_id?: string
          created_at?: string
          id?: string
          mistake_type?: string
          review_id?: string
          surah_id?: number
          user_id?: string
          word_index?: number
          word_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_review_mistakes_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "memorization_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_review_mistakes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "block_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      block_reviews: {
        Row: {
          block_id: string
          block_mistake_score: number
          created_at: string
          ease_after: number
          ease_before: number
          entered_focus_review: boolean
          id: string
          interval_after: number
          interval_before: number
          mistake_count_forgot: number
          mistake_count_incorrect: number
          mistake_count_missed: number
          mistake_count_tajweed: number
          normalized_mistake_score: number
          override_applied: string | null
          repeated_problem_words_count: number
          session_rating: string
          strength_after: number
          strength_before: number
          total_words_in_block: number
          user_id: string
        }
        Insert: {
          block_id: string
          block_mistake_score?: number
          created_at?: string
          ease_after?: number
          ease_before?: number
          entered_focus_review?: boolean
          id?: string
          interval_after?: number
          interval_before?: number
          mistake_count_forgot?: number
          mistake_count_incorrect?: number
          mistake_count_missed?: number
          mistake_count_tajweed?: number
          normalized_mistake_score?: number
          override_applied?: string | null
          repeated_problem_words_count?: number
          session_rating: string
          strength_after?: number
          strength_before?: number
          total_words_in_block?: number
          user_id: string
        }
        Update: {
          block_id?: string
          block_mistake_score?: number
          created_at?: string
          ease_after?: number
          ease_before?: number
          entered_focus_review?: boolean
          id?: string
          interval_after?: number
          interval_before?: number
          mistake_count_forgot?: number
          mistake_count_incorrect?: number
          mistake_count_missed?: number
          mistake_count_tajweed?: number
          normalized_mistake_score?: number
          override_applied?: string | null
          repeated_problem_words_count?: number
          session_rating?: string
          strength_after?: number
          strength_before?: number
          total_words_in_block?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_reviews_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "memorization_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      block_word_stats: {
        Row: {
          ayah_number: number
          block_id: string
          id: string
          last_mistake_at: string | null
          recent_mistake_count_7d: number
          total_forgot_count: number
          total_incorrect_count: number
          total_missed_count: number
          total_tajweed_count: number
          updated_at: string
          user_id: string
          word_index: number
          word_text: string
        }
        Insert: {
          ayah_number: number
          block_id: string
          id?: string
          last_mistake_at?: string | null
          recent_mistake_count_7d?: number
          total_forgot_count?: number
          total_incorrect_count?: number
          total_missed_count?: number
          total_tajweed_count?: number
          updated_at?: string
          user_id: string
          word_index: number
          word_text?: string
        }
        Update: {
          ayah_number?: number
          block_id?: string
          id?: string
          last_mistake_at?: string | null
          recent_mistake_count_7d?: number
          total_forgot_count?: number
          total_incorrect_count?: number
          total_missed_count?: number
          total_tajweed_count?: number
          updated_at?: string
          user_id?: string
          word_index?: number
          word_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_word_stats_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "memorization_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
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
      local_bookmarks: {
        Row: {
          ayah_number: number
          collection_id: string
          created_at: string
          id: string
          surah_id: number
          user_id: string
        }
        Insert: {
          ayah_number: number
          collection_id: string
          created_at?: string
          id?: string
          surah_id: number
          user_id: string
        }
        Update: {
          ayah_number?: number
          collection_id?: string
          created_at?: string
          id?: string
          surah_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_bookmarks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "local_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      local_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      memorization_blocks: {
        Row: {
          created_at: string
          current_streak: number
          ease_factor: number
          end_ayah: number
          id: string
          interval_days: number
          last_reviewed_at: string | null
          last_session_rating: string | null
          mastery_status: string
          needs_focus_review: boolean
          next_review_at: string | null
          overdue_count: number
          perfect_reviews: number
          priority_level: string
          recent_mistakes_7d: number
          recent_ratings: Json
          repeated_problem_words_count: number
          start_ayah: number
          strength_score: number
          successful_reviews: number
          surah_id: number
          total_mistakes: number
          total_reviews: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          ease_factor?: number
          end_ayah: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          last_session_rating?: string | null
          mastery_status?: string
          needs_focus_review?: boolean
          next_review_at?: string | null
          overdue_count?: number
          perfect_reviews?: number
          priority_level?: string
          recent_mistakes_7d?: number
          recent_ratings?: Json
          repeated_problem_words_count?: number
          start_ayah: number
          strength_score?: number
          successful_reviews?: number
          surah_id: number
          total_mistakes?: number
          total_reviews?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          ease_factor?: number
          end_ayah?: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          last_session_rating?: string | null
          mastery_status?: string
          needs_focus_review?: boolean
          next_review_at?: string | null
          overdue_count?: number
          perfect_reviews?: number
          priority_level?: string
          recent_mistakes_7d?: number
          recent_ratings?: Json
          repeated_problem_words_count?: number
          start_ayah?: number
          strength_score?: number
          successful_reviews?: number
          surah_id?: number
          total_mistakes?: number
          total_reviews?: number
          updated_at?: string
          user_id?: string
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
      mushaf_lines: {
        Row: {
          created_at: string
          id: string
          line_number: number
          page_number: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_number: number
          page_number: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_number?: number
          page_number?: number
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mushaf_lines_page_number_fkey"
            columns: ["page_number"]
            isOneToOne: false
            referencedRelation: "mushaf_pages"
            referencedColumns: ["page_number"]
          },
          {
            foreignKeyName: "mushaf_lines_page_number_fkey"
            columns: ["page_number"]
            isOneToOne: false
            referencedRelation: "v_mushaf_page"
            referencedColumns: ["page_number"]
          },
        ]
      }
      mushaf_pages: {
        Row: {
          ayah_end: number | null
          ayah_start: number | null
          created_at: string
          hizb_number: number | null
          juz_number: number | null
          page_number: number
          rub_number: number | null
          surah_end: number | null
          surah_start: number | null
          updated_at: string
        }
        Insert: {
          ayah_end?: number | null
          ayah_start?: number | null
          created_at?: string
          hizb_number?: number | null
          juz_number?: number | null
          page_number: number
          rub_number?: number | null
          surah_end?: number | null
          surah_start?: number | null
          updated_at?: string
        }
        Update: {
          ayah_end?: number | null
          ayah_start?: number | null
          created_at?: string
          hizb_number?: number | null
          juz_number?: number | null
          page_number?: number
          rub_number?: number | null
          surah_end?: number | null
          surah_start?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      mushaf_words: {
        Row: {
          ayah_number: number
          char_type: Database["public"]["Enums"]["mushaf_char_type"] | null
          created_at: string
          external_ayah_key: string | null
          external_word_id: number | null
          id: string
          line_number: number
          page_number: number
          position_in_ayah: number | null
          position_in_line: number | null
          surah_number: number
          text_uthmani: string
          updated_at: string
        }
        Insert: {
          ayah_number: number
          char_type?: Database["public"]["Enums"]["mushaf_char_type"] | null
          created_at?: string
          external_ayah_key?: string | null
          external_word_id?: number | null
          id?: string
          line_number: number
          page_number: number
          position_in_ayah?: number | null
          position_in_line?: number | null
          surah_number: number
          text_uthmani: string
          updated_at?: string
        }
        Update: {
          ayah_number?: number
          char_type?: Database["public"]["Enums"]["mushaf_char_type"] | null
          created_at?: string
          external_ayah_key?: string | null
          external_word_id?: number | null
          id?: string
          line_number?: number
          page_number?: number
          position_in_ayah?: number | null
          position_in_line?: number | null
          surah_number?: number
          text_uthmani?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mushaf_words_page_number_fkey"
            columns: ["page_number"]
            isOneToOne: false
            referencedRelation: "mushaf_pages"
            referencedColumns: ["page_number"]
          },
          {
            foreignKeyName: "mushaf_words_page_number_fkey"
            columns: ["page_number"]
            isOneToOne: false
            referencedRelation: "v_mushaf_page"
            referencedColumns: ["page_number"]
          },
        ]
      }
      pages: {
        Row: {
          first_word_id: number | null
          id: number
          is_centered: boolean
          last_word_id: number | null
          line_number: number
          line_type: string
          page_number: number
          surah_number: number | null
        }
        Insert: {
          first_word_id?: number | null
          id?: number
          is_centered?: boolean
          last_word_id?: number | null
          line_number: number
          line_type?: string
          page_number: number
          surah_number?: number | null
        }
        Update: {
          first_word_id?: number | null
          id?: number
          is_centered?: boolean
          last_word_id?: number | null
          line_number?: number
          line_type?: string
          page_number?: number
          surah_number?: number | null
        }
        Relationships: []
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
      quran_audio_cache: {
        Row: {
          audio_data: Json | null
          audio_url: string
          chapter_number: number
          fetched_at: string
          id: string
          reciter_id: number
          updated_at: string
          verse_key: string | null
        }
        Insert: {
          audio_data?: Json | null
          audio_url: string
          chapter_number: number
          fetched_at?: string
          id?: string
          reciter_id?: number
          updated_at?: string
          verse_key?: string | null
        }
        Update: {
          audio_data?: Json | null
          audio_url?: string
          chapter_number?: number
          fetched_at?: string
          id?: string
          reciter_id?: number
          updated_at?: string
          verse_key?: string | null
        }
        Relationships: []
      }
      quran_chapters_cache: {
        Row: {
          chapter_data: Json | null
          chapter_number: number
          fetched_at: string
          name_arabic: string
          name_english: string
          name_simple: string
          pages: Json | null
          revelation_place: string | null
          updated_at: string
          verses_count: number
        }
        Insert: {
          chapter_data?: Json | null
          chapter_number: number
          fetched_at?: string
          name_arabic: string
          name_english: string
          name_simple: string
          pages?: Json | null
          revelation_place?: string | null
          updated_at?: string
          verses_count?: number
        }
        Update: {
          chapter_data?: Json | null
          chapter_number?: number
          fetched_at?: string
          name_arabic?: string
          name_english?: string
          name_simple?: string
          pages?: Json | null
          revelation_place?: string | null
          updated_at?: string
          verses_count?: number
        }
        Relationships: []
      }
      quran_tafsir_cache: {
        Row: {
          fetched_at: string
          id: string
          tafsir_data: Json | null
          tafsir_id: number
          tafsir_text: string | null
          updated_at: string
          verse_key: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          tafsir_data?: Json | null
          tafsir_id?: number
          tafsir_text?: string | null
          updated_at?: string
          verse_key: string
        }
        Update: {
          fetched_at?: string
          id?: string
          tafsir_data?: Json | null
          tafsir_id?: number
          tafsir_text?: string | null
          updated_at?: string
          verse_key?: string
        }
        Relationships: []
      }
      quran_verses_cache: {
        Row: {
          chapter_number: number
          fetched_at: string
          id: string
          text_uthmani: string
          translation_id: number
          translation_text: string | null
          updated_at: string
          verse_key: string
          verse_number: number
          words: Json | null
        }
        Insert: {
          chapter_number: number
          fetched_at?: string
          id?: string
          text_uthmani: string
          translation_id?: number
          translation_text?: string | null
          updated_at?: string
          verse_key: string
          verse_number: number
          words?: Json | null
        }
        Update: {
          chapter_number?: number
          fetched_at?: string
          id?: string
          text_uthmani?: string
          translation_id?: number
          translation_text?: string | null
          updated_at?: string
          verse_key?: string
          verse_number?: number
          words?: Json | null
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
      words: {
        Row: {
          ayah: number
          id: number
          location: string | null
          surah: number
          text: string
          word: number
        }
        Insert: {
          ayah: number
          id?: number
          location?: string | null
          surah: number
          text: string
          word: number
        }
        Update: {
          ayah?: number
          id?: number
          location?: string | null
          surah?: number
          text?: string
          word?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_mushaf_page: {
        Row: {
          line_number: number | null
          page_number: number | null
          words: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      expire_old_invites: { Args: never; Returns: undefined }
      generate_session_code: { Args: never; Returns: string }
    }
    Enums: {
      mushaf_char_type:
        | "word"
        | "end"
        | "pause"
        | "ruby"
        | "bismillah"
        | "sajdah"
        | "hamza"
        | "other"
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
      mushaf_char_type: [
        "word",
        "end",
        "pause",
        "ruby",
        "bismillah",
        "sajdah",
        "hamza",
        "other",
      ],
      revision_status: ["pending", "revised", "needsReview"],
      room_role: ["reciter", "checker"],
    },
  },
} as const

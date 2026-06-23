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
      activity_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
          store_code: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          store_code?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          store_code?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value?: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      campaign_briefs: {
        Row: {
          additional_requests: string
          body_min_chars_no_spaces: number
          created_at: string
          created_by: string | null
          id: string
          keyword_required_count: number
          keywords: string[]
          media_requirements: Json
          store_code: string
          subject_value: string
          writer_style: string
        }
        Insert: {
          additional_requests?: string
          body_min_chars_no_spaces?: number
          created_at?: string
          created_by?: string | null
          id?: string
          keyword_required_count?: number
          keywords?: string[]
          media_requirements?: Json
          store_code: string
          subject_value: string
          writer_style?: string
        }
        Update: {
          additional_requests?: string
          body_min_chars_no_spaces?: number
          created_at?: string
          created_by?: string | null
          id?: string
          keyword_required_count?: number
          keywords?: string[]
          media_requirements?: Json
          store_code?: string
          subject_value?: string
          writer_style?: string
        }
        Relationships: []
      }
      campaign_verifications: {
        Row: {
          body: Json | null
          brief_id: string | null
          created_at: string
          created_by: string | null
          draft_id: string | null
          id: string
          keywords: Json | null
          media: Json | null
          passed: boolean
          report_text: string | null
          request_results: Json | null
          source_url: string | null
          store_code: string
        }
        Insert: {
          body?: Json | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          id?: string
          keywords?: Json | null
          media?: Json | null
          passed?: boolean
          report_text?: string | null
          request_results?: Json | null
          source_url?: string | null
          store_code: string
        }
        Update: {
          body?: Json | null
          brief_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          id?: string
          keywords?: Json | null
          media?: Json | null
          passed?: boolean
          report_text?: string | null
          request_results?: Json | null
          source_url?: string | null
          store_code?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          industry: string | null
          message: string | null
          name: string
          phone: string
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          store_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          message?: string | null
          name: string
          phone: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          store_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          message?: string | null
          name?: string
          phone?: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          store_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_drafts: {
        Row: {
          ai_model: string | null
          body: string
          channel: Database["public"]["Enums"]["sns_channel"] | null
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          image_urls: string[]
          status: Database["public"]["Enums"]["draft_status"]
          store_code: string
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["sns_channel"] | null
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          image_urls?: string[]
          status?: Database["public"]["Enums"]["draft_status"]
          store_code: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["sns_channel"] | null
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          image_urls?: string[]
          status?: Database["public"]["Enums"]["draft_status"]
          store_code?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          id: string
          store_code: string
          created_by: string
          job_type: string
          status: string
          progress: number
          priority: number
          batch_id: string | null
          input: Json
          result: Json | null
          error_message: string | null
          draft_id: string | null
          created_at: string
          updated_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          store_code: string
          created_by: string
          job_type: string
          status?: string
          progress?: number
          priority?: number
          batch_id?: string | null
          input?: Json
          result?: Json | null
          error_message?: string | null
          draft_id?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          store_code?: string
          created_by?: string
          job_type?: string
          status?: string
          progress?: number
          priority?: number
          batch_id?: string | null
          input?: Json
          result?: Json | null
          error_message?: string | null
          draft_id?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          industry: string | null
          instagram_handle: string | null
          naver_handle: string | null
          onboarded_at: string | null
          sns_channels: Json
          store_code: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          industry?: string | null
          instagram_handle?: string | null
          naver_handle?: string | null
          onboarded_at?: string | null
          sns_channels?: Json
          store_code?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          instagram_handle?: string | null
          naver_handle?: string | null
          onboarded_at?: string | null
          sns_channels?: Json
          store_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publish_schedule: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["sns_channel"]
          created_at: string
          draft_id: string
          external_post_id: string | null
          id: string
          last_error: string | null
          published_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["schedule_status"]
          store_code: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["sns_channel"]
          created_at?: string
          draft_id: string
          external_post_id?: string | null
          id?: string
          last_error?: string | null
          published_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
          store_code: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["sns_channel"]
          created_at?: string
          draft_id?: string
          external_post_id?: string | null
          id?: string
          last_error?: string | null
          published_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          store_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_schedule_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          id: string
          store_code: string
          platform: string
          platform_user_id: string
          display_name: string
          access_token_enc: string
          refresh_token_enc: string | null
          token_expires_at: string | null
          metadata: Json
          connected_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_code: string
          platform: string
          platform_user_id: string
          display_name?: string
          access_token_enc: string
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          metadata?: Json
          connected_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_code?: string
          platform?: string
          platform_user_id?: string
          display_name?: string
          access_token_enc?: string
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          metadata?: Json
          connected_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          id: string
          store_code: string
          account_id: string | null
          platform: string
          status: string
          caption: string
          media_urls: Json
          platform_options: Json
          scheduled_at: string | null
          published_at: string | null
          platform_post_id: string | null
          error_message: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_code: string
          account_id?: string | null
          platform: string
          status?: string
          caption?: string
          media_urls?: Json
          platform_options?: Json
          scheduled_at?: string | null
          published_at?: string | null
          platform_post_id?: string | null
          error_message?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_code?: string
          account_id?: string | null
          platform?: string
          status?: string
          caption?: string
          media_urls?: Json
          platform_options?: Json
          scheduled_at?: string | null
          published_at?: string | null
          platform_post_id?: string | null
          error_message?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          store_code: string
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_code: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_code?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sns_sessions: {
        Row: {
          account_handle: string | null
          channel: Database["public"]["Enums"]["sns_channel"]
          created_at: string
          expires_at: string | null
          id: string
          last_verified_at: string | null
          notes: string | null
          proxy_region: string | null
          status: Database["public"]["Enums"]["session_status"]
          store_code: string
          updated_at: string
        }
        Insert: {
          account_handle?: string | null
          channel: Database["public"]["Enums"]["sns_channel"]
          created_at?: string
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          proxy_region?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          store_code: string
          updated_at?: string
        }
        Update: {
          account_handle?: string | null
          channel?: Database["public"]["Enums"]["sns_channel"]
          created_at?: string
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          proxy_region?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          store_code?: string
          updated_at?: string
        }
        Relationships: []
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
      claim_generation_jobs: {
        Args: { p_limit?: number }
        Returns: Database["public"]["Tables"]["generation_jobs"]["Row"][]
      }
      current_store_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "admin"
      draft_status: "draft" | "review" | "approved" | "published" | "archived"
      lead_status: "new" | "contacted" | "converted" | "dropped"
      schedule_status:
        | "queued"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled"
      session_status: "active" | "expiring" | "expired" | "revoked"
      sns_channel: "instagram" | "tiktok" | "naver" | "kakao"
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
      app_role: ["owner", "staff", "admin"],
      draft_status: ["draft", "review", "approved", "published", "archived"],
      lead_status: ["new", "contacted", "converted", "dropped"],
      schedule_status: [
        "queued",
        "publishing",
        "published",
        "failed",
        "cancelled",
      ],
      session_status: ["active", "expiring", "expired", "revoked"],
      sns_channel: ["instagram", "tiktok", "naver", "kakao"],
    },
  },
} as const

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
      assignment_files: {
        Row: {
          assignment_id: string
          bid_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          released: boolean
          storage_path: string
          writer_id: string
        }
        Insert: {
          assignment_id: string
          bid_id: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          released?: boolean
          storage_path: string
          writer_id: string
        }
        Update: {
          assignment_id?: string
          bid_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          released?: boolean
          storage_path?: string
          writer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_files_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_files_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: true
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          accepted_bid_id: string | null
          budget_max: number
          budget_min: number
          created_at: string
          deadline: string
          description: string
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          subject: string
          title: string
        }
        Insert: {
          accepted_bid_id?: string | null
          budget_max: number
          budget_min: number
          created_at?: string
          deadline: string
          description: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          subject: string
          title: string
        }
        Update: {
          accepted_bid_id?: string | null
          budget_max?: number
          budget_min?: number
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id?: string
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          assignment_id: string
          created_at: string
          id: string
          message: string | null
          status: Database["public"]["Enums"]["bid_status"]
          writer_id: string
        }
        Insert: {
          amount: number
          assignment_id: string
          created_at?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          writer_id: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          created_at?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          writer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_writer_id_fkey"
            columns: ["writer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          assignment_id: string
          content: string
          created_at: string
          id: string
          offer_amount: number | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          assignment_id: string
          content: string
          created_at?: string
          id?: string
          offer_amount?: number | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          assignment_id?: string
          content?: string
          created_at?: string
          id?: string
          offer_amount?: number | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          assignment_id: string
          bid_id: string
          commission: number
          created_at: string
          id: string
          payment_received_at: string | null
          released_at: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
          writer_id: string
          writer_payout: number
        }
        Insert: {
          amount: number
          assignment_id: string
          bid_id: string
          commission: number
          created_at?: string
          id?: string
          payment_received_at?: string | null
          released_at?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
          writer_id: string
          writer_payout: number
        }
        Update: {
          amount?: number
          assignment_id?: string
          bid_id?: string
          commission?: number
          created_at?: string
          id?: string
          payment_received_at?: string | null
          released_at?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
          writer_id?: string
          writer_payout?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: true
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          jobs_completed: number
          rating: number
          role: Database["public"]["Enums"]["user_role"]
          upi_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          jobs_completed?: number
          rating?: number
          role?: Database["public"]["Enums"]["user_role"]
          upi_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          jobs_completed?: number
          rating?: number
          role?: Database["public"]["Enums"]["user_role"]
          upi_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purge_expired_assignments: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      assignment_status: "open" | "in_progress" | "completed" | "cancelled"
      bid_status: "pending" | "accepted" | "rejected" | "withdrawn"
      payment_status:
        | "awaiting_payment"
        | "payment_received"
        | "file_delivered"
        | "cancelled"
      user_role: "student" | "writer"
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
      assignment_status: ["open", "in_progress", "completed", "cancelled"],
      bid_status: ["pending", "accepted", "rejected", "withdrawn"],
      payment_status: [
        "awaiting_payment",
        "payment_received",
        "file_delivered",
        "cancelled",
      ],
      user_role: ["student", "writer"],
    },
  },
} as const

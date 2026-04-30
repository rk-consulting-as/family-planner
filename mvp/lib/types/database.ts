// Generated-style types for Supabase. In production, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > lib/types/database.ts
// This hand-written version covers the MVP schema.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          color_hex: string | null;
          auth_kind: string | null;
          pin_hash: string | null;
          default_collision_check_scope: string | null;
          default_reminder_minutes: number[] | null;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          timezone: string | null;
          locale: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      groups: {
        Row: {
          id: string;
          name: string;
          type: "family" | "team" | "club" | "organization" | "other";
          description: string | null;
          invite_code: string | null;
          owner_id: string;
          settings: Record<string, unknown> | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["groups"]["Row"]> & {
          name: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Row"]>;
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string;
          role: "owner" | "admin" | "member";
          nickname: string | null;
          color_hex: string | null;
          joined_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["group_members"]["Row"]> & {
          group_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Row"]>;
      };
      timetable_entries: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string;
          subject: string;
          room: string | null;
          teacher: string | null;
          notes: string | null;
          start_time: string;
          end_time: string;
          start_date: string;
          recurrence_rule: string | null;
          exception_dates: string[] | null;
          color_hex: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["timetable_entries"]["Row"]> & {
          group_id: string;
          profile_id: string;
          subject: string;
          start_time: string;
          end_time: string;
          start_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["timetable_entries"]["Row"]>;
      };
      chores: {
        Row: {
          id: string;
          group_id: string;
          title: string;
          description: string | null;
          estimated_minutes: number | null;
          recurrence_rule: string | null;
          reward_type: "money" | "screen_time_minutes" | "points" | "badge" | "custom" | null;
          reward_value: number | null;
          reward_custom_text: string | null;
          requires_approval: boolean | null;
          pool_enabled: boolean | null;
          default_assignee_id: string | null;
          created_by: string;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["chores"]["Row"]> & {
          group_id: string;
          title: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["chores"]["Row"]>;
      };
      chore_assignments: {
        Row: {
          id: string;
          chore_id: string;
          group_id: string;
          assigned_to: string | null;
          due_date: string | null;
          status: "available" | "selected" | "in_progress" | "completed" | "approved" | "rejected";
          selected_at: string | null;
          completed_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          rejection_reason: string | null;
          proof_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["chore_assignments"]["Row"]> & {
          chore_id: string;
          group_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["chore_assignments"]["Row"]>;
      };
      walking_entries: {
        Row: {
          id: string;
          group_id: string;
          occurred_on: string;
          distance_km: number;
          duration_minutes: number | null;
          notes: string | null;
          participant_ids: string[];
          created_by: string;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["walking_entries"]["Row"]> & {
          group_id: string;
          occurred_on: string;
          distance_km: number;
          participant_ids: string[];
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["walking_entries"]["Row"]>;
      };
      reward_transactions: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string;
          type: "money" | "screen_time_minutes" | "points" | "badge" | "custom";
          amount: number;
          source_kind: string;
          source_id: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["reward_transactions"]["Row"]> & {
          group_id: string;
          profile_id: string;
          type: "money" | "screen_time_minutes" | "points" | "badge" | "custom";
          amount: number;
          source_kind: string;
        };
        Update: Partial<Database["public"]["Tables"]["reward_transactions"]["Row"]>;
      };
      goals: {
        Row: {
          id: string;
          group_id: string;
          title: string;
          type: "walking_distance_km" | "walking_count" | "chore_count" | "reading_count" | "custom";
          target_value: number;
          period: "daily" | "weekly" | "monthly" | "custom_range";
          period_start: string;
          period_end: string | null;
          recurrence_rule: string | null;
          assignee_ids: string[];
          reward_type: string | null;
          reward_value: number | null;
          reward_custom_text: string | null;
          status: "active" | "completed" | "failed" | "archived";
          created_by: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["goals"]["Row"]> & {
          group_id: string;
          title: string;
          type: Database["public"]["Tables"]["goals"]["Row"]["type"];
          target_value: number;
          period: Database["public"]["Tables"]["goals"]["Row"]["period"];
          period_start: string;
          assignee_ids: string[];
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          group_id: string | null;
          title: string;
          body: string | null;
          link_url: string | null;
          source_kind: string | null;
          source_id: string | null;
          read_at: string | null;
          delivered_channels: string[] | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          recipient_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      invitations: {
        Row: {
          id: string;
          group_id: string;
          invited_email: string | null;
          invited_by: string;
          role: "owner" | "admin" | "member";
          token: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["invitations"]["Row"]> & {
          group_id: string;
          invited_by: string;
          token: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Row"]>;
      };
      events: {
        Row: {
          id: string;
          group_id: string;
          kind: "school" | "chore" | "activity" | "walk" | "goal_milestone" | "custom";
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string;
          all_day: boolean | null;
          recurrence_rule: string | null;
          participant_ids: string[];
          created_by: string;
          reminder_minutes: number[] | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & {
          group_id: string;
          title: string;
          starts_at: string;
          ends_at: string;
          participant_ids: string[];
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
      };
    };
    Views: {
      reward_balances: {
        Row: {
          profile_id: string;
          group_id: string;
          type: "money" | "screen_time_minutes" | "points" | "badge" | "custom";
          balance: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

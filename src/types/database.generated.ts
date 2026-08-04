export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Aus den versionierten Supabase-Migrationen 001–034 abgeleitet.
// Nach einem lokalen `supabase db reset` kann die Datei mit
// `npm run supabase:types:local` gegen die echte Datenbank neu erzeugt werden.
export type Database = {
  public: {
    Tables: {
      app_modules: {
        Row: {
          key: string;
          title: string;
          description: string | null;
          route: string;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          title: string;
          description?: string | null;
          route: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          title?: string;
          description?: string | null;
          route?: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_availability_defaults: {
        Row: {
          organization_id: string;
          group_id: string;
          athlete_id: string;
          weekday: number;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from: string | null;
          available_until: string | null;
          comment: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          group_id: string;
          athlete_id: string;
          weekday: number;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          group_id?: string;
          athlete_id?: string;
          weekday?: number;
          status?: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_contacts: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          contact_name: string;
          relationship: string | null;
          phone: string;
          is_emergency: boolean;
          priority: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          contact_name: string;
          relationship?: string | null;
          phone: string;
          is_emergency?: boolean;
          priority?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          contact_name?: string;
          relationship?: string | null;
          phone?: string;
          is_emergency?: boolean;
          priority?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_group_memberships: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          group_id: string;
          started_on: string;
          ended_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          group_id: string;
          started_on?: string;
          ended_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          group_id?: string;
          started_on?: string;
          ended_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_plan_items: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          section_id: string;
          source_exercise_id: string | null;
          exercise_name: string;
          category_title: string;
          note: string | null;
          parameter_definitions: Json;
          parameter_values: Json;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          section_id: string;
          source_exercise_id?: string | null;
          exercise_name: string;
          category_title?: string;
          note?: string | null;
          parameter_definitions?: Json;
          parameter_values?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          section_id?: string;
          source_exercise_id?: string | null;
          exercise_name?: string;
          category_title?: string;
          note?: string | null;
          parameter_definitions?: Json;
          parameter_values?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_plan_sections: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          section_type: string;
          source_block_id: string | null;
          counts_as_block_usage: boolean;
          name: string;
          goal: string | null;
          description: string | null;
          estimated_minutes: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          section_type: string;
          source_block_id?: string | null;
          counts_as_block_usage?: boolean;
          name: string;
          goal?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          section_type?: string;
          source_block_id?: string | null;
          counts_as_block_usage?: boolean;
          name?: string;
          goal?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_plans: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          group_id: string;
          training_date: string;
          title: string;
          notes: string | null;
          status: string;
          source_plan_id: string | null;
          copied_from_athlete_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          group_id: string;
          training_date: string;
          title: string;
          notes?: string | null;
          status?: string;
          source_plan_id?: string | null;
          copied_from_athlete_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          group_id?: string;
          training_date?: string;
          title?: string;
          notes?: string | null;
          status?: string;
          source_plan_id?: string | null;
          copied_from_athlete_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_session_items: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          section_id: string;
          source_plan_item_id: string | null;
          source_exercise_id: string | null;
          exercise_name: string;
          category_title: string;
          planned_note: string | null;
          parameter_definitions: Json;
          planned_values: Json;
          actual_values: Json;
          status: string;
          rating: number | null;
          rpe: number | null;
          comment: string | null;
          pain_level: string;
          pain_comment: string | null;
          trainer_comment: string | null;
          exercise_video_url: string | null;
          exercise_video_storage_path: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          session_id: string;
          section_id: string;
          source_plan_item_id?: string | null;
          source_exercise_id?: string | null;
          exercise_name: string;
          category_title?: string;
          planned_note?: string | null;
          parameter_definitions?: Json;
          planned_values?: Json;
          actual_values?: Json;
          status?: string;
          rating?: number | null;
          rpe?: number | null;
          comment?: string | null;
          pain_level?: string;
          pain_comment?: string | null;
          trainer_comment?: string | null;
          exercise_video_url?: string | null;
          exercise_video_storage_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          session_id?: string;
          section_id?: string;
          source_plan_item_id?: string | null;
          source_exercise_id?: string | null;
          exercise_name?: string;
          category_title?: string;
          planned_note?: string | null;
          parameter_definitions?: Json;
          planned_values?: Json;
          actual_values?: Json;
          status?: string;
          rating?: number | null;
          rpe?: number | null;
          comment?: string | null;
          pain_level?: string;
          pain_comment?: string | null;
          trainer_comment?: string | null;
          exercise_video_url?: string | null;
          exercise_video_storage_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_session_media: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          item_id: string;
          storage_path: string;
          title: string;
          mime_type: string;
          file_size: number;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          session_id: string;
          item_id: string;
          storage_path: string;
          title: string;
          mime_type: string;
          file_size: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          session_id?: string;
          item_id?: string;
          storage_path?: string;
          title?: string;
          mime_type?: string;
          file_size?: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_session_sections: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          source_plan_section_id: string | null;
          name: string;
          description: string | null;
          estimated_minutes: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          session_id: string;
          source_plan_section_id?: string | null;
          name: string;
          description?: string | null;
          estimated_minutes?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          session_id?: string;
          source_plan_section_id?: string | null;
          name?: string;
          description?: string | null;
          estimated_minutes?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_session_sets: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          item_id: string;
          set_number: number;
          planned_values: Json;
          actual_values: Json;
          status: string;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          session_id: string;
          item_id: string;
          set_number: number;
          planned_values?: Json;
          actual_values?: Json;
          status?: string;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          session_id?: string;
          item_id?: string;
          set_number?: number;
          planned_values?: Json;
          actual_values?: Json;
          status?: string;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_training_sessions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          athlete_id: string;
          group_id: string;
          training_date: string;
          athlete_name_snapshot: string;
          group_name_snapshot: string;
          plan_title_snapshot: string;
          plan_notes_snapshot: string | null;
          status: string;
          started_at: string;
          completed_at: string | null;
          planned_minutes_snapshot: number;
          actual_minutes: number | null;
          overall_rpe: number | null;
          overall_rating: number | null;
          overall_comment: string | null;
          pain_level: string;
          pain_comment: string | null;
          trainer_feedback: string | null;
          trainer_reviewed_at: string | null;
          trainer_reviewed_by: string | null;
          edited_after_completion: boolean;
          created_by: string | null;
          last_saved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          athlete_id: string;
          group_id: string;
          training_date: string;
          athlete_name_snapshot: string;
          group_name_snapshot: string;
          plan_title_snapshot: string;
          plan_notes_snapshot?: string | null;
          status?: string;
          started_at?: string;
          completed_at?: string | null;
          planned_minutes_snapshot?: number;
          actual_minutes?: number | null;
          overall_rpe?: number | null;
          overall_rating?: number | null;
          overall_comment?: string | null;
          pain_level?: string;
          pain_comment?: string | null;
          trainer_feedback?: string | null;
          trainer_reviewed_at?: string | null;
          trainer_reviewed_by?: string | null;
          edited_after_completion?: boolean;
          created_by?: string | null;
          last_saved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          athlete_id?: string;
          group_id?: string;
          training_date?: string;
          athlete_name_snapshot?: string;
          group_name_snapshot?: string;
          plan_title_snapshot?: string;
          plan_notes_snapshot?: string | null;
          status?: string;
          started_at?: string;
          completed_at?: string | null;
          planned_minutes_snapshot?: number;
          actual_minutes?: number | null;
          overall_rpe?: number | null;
          overall_rating?: number | null;
          overall_comment?: string | null;
          pain_level?: string;
          pain_comment?: string | null;
          trainer_feedback?: string | null;
          trainer_reviewed_at?: string | null;
          trainer_reviewed_by?: string | null;
          edited_after_completion?: boolean;
          created_by?: string | null;
          last_saved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athletes: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          birth_year: number | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          linked_user_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          birth_year?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          linked_user_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          birth_year?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          linked_user_id?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          organization_id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      data_import_runs: {
        Row: {
          organization_id: string;
          import_id: string;
          import_kind: string;
          requested_by: string;
          payload_hash: string;
          result: Json;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          import_id: string;
          import_kind: string;
          requested_by: string;
          payload_hash: string;
          result: Json;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          import_id?: string;
          import_kind?: string;
          requested_by?: string;
          payload_hash?: string;
          result?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      edit_locks: {
        Row: {
          organization_id: string;
          entity_type: string;
          entity_id: string;
          lock_token: string;
          locked_by_user_id: string;
          locked_by_membership_id: string;
          locked_by_name: string;
          acquired_at: string;
          heartbeat_at: string;
          expires_at: string;
        };
        Insert: {
          organization_id: string;
          entity_type: string;
          entity_id: string;
          lock_token: string;
          locked_by_user_id: string;
          locked_by_membership_id: string;
          locked_by_name: string;
          acquired_at?: string;
          heartbeat_at?: string;
          expires_at: string;
        };
        Update: {
          organization_id?: string;
          entity_type?: string;
          entity_id?: string;
          lock_token?: string;
          locked_by_user_id?: string;
          locked_by_membership_id?: string;
          locked_by_name?: string;
          acquired_at?: string;
          heartbeat_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      exercise_categories: {
        Row: {
          key: string;
          title: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          title: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          title?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_group_assignments: {
        Row: {
          organization_id: string;
          exercise_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          exercise_id: string;
          group_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          exercise_id?: string;
          group_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exercise_parameter_definitions: {
        Row: {
          id: string;
          organization_id: string;
          exercise_id: string;
          parameter_key: string;
          label: string;
          unit: string;
          input_type: string;
          default_value: string | null;
          min_value: number | null;
          max_value: number | null;
          step_value: number | null;
          is_required: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          exercise_id: string;
          parameter_key: string;
          label: string;
          unit?: string;
          input_type: string;
          default_value?: string | null;
          min_value?: number | null;
          max_value?: number | null;
          step_value?: number | null;
          is_required?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          exercise_id?: string;
          parameter_key?: string;
          label?: string;
          unit?: string;
          input_type?: string;
          default_value?: string | null;
          min_value?: number | null;
          max_value?: number | null;
          step_value?: number | null;
          is_required?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_user_favorites: {
        Row: {
          organization_id: string;
          exercise_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          exercise_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          exercise_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exercise_videos: {
        Row: {
          id: string;
          organization_id: string;
          exercise_id: string;
          storage_path: string;
          title: string;
          mime_type: string;
          file_size: number;
          is_primary: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          exercise_id: string;
          storage_path: string;
          title: string;
          mime_type: string;
          file_size: number;
          is_primary?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          exercise_id?: string;
          storage_path?: string;
          title?: string;
          mime_type?: string;
          file_size?: number;
          is_primary?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_similarities: {
        Row: {
          organization_id: string;
          exercise_id: string;
          related_exercise_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          exercise_id: string;
          related_exercise_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          exercise_id?: string;
          related_exercise_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category_key: string;
          subcategory: string | null;
          goal: string | null;
          description: string | null;
          coaching_cues: string | null;
          common_mistakes: string | null;
          equipment: string[];
          video_url: string | null;
          is_active: boolean;
          difficulty_key: string | null;
          normalized_name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          category_key: string;
          subcategory?: string | null;
          goal?: string | null;
          description?: string | null;
          coaching_cues?: string | null;
          common_mistakes?: string | null;
          equipment?: string[];
          video_url?: string | null;
          is_active?: boolean;
          difficulty_key?: string | null;
          normalized_name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          category_key?: string;
          subcategory?: string | null;
          goal?: string | null;
          description?: string | null;
          coaching_cues?: string | null;
          common_mistakes?: string | null;
          equipment?: string[];
          video_url?: string | null;
          is_active?: boolean;
          difficulty_key?: string | null;
          normalized_name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_module_permissions: {
        Row: {
          membership_id: string;
          module_key: string;
          can_view: boolean;
          can_edit: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          membership_id: string;
          module_key: string;
          can_view?: boolean;
          can_edit?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          membership_id?: string;
          module_key?: string;
          can_view?: boolean;
          can_edit?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_dropdown_options: {
        Row: {
          id: string;
          organization_id: string;
          list_key: string;
          option_key: string;
          label: string;
          unit: string;
          input_type: string;
          step_value: number | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          list_key: string;
          option_key: string;
          label: string;
          unit?: string;
          input_type?: string;
          step_value?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          list_key?: string;
          option_key?: string;
          label?: string;
          unit?: string;
          input_type?: string;
          step_value?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_exercise_categories: {
        Row: {
          organization_id: string;
          category_key: string;
          title: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          category_key: string;
          title: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          category_key?: string;
          title?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_member_athlete_links: {
        Row: {
          organization_id: string;
          membership_id: string;
          athlete_id: string;
          relation_type: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          membership_id: string;
          athlete_id: string;
          relation_type: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          membership_id?: string;
          athlete_id?: string;
          relation_type?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["membership_status"];
          created_by: string | null;
          invitation_last_sent_at: string | null;
          invitation_send_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          created_by?: string | null;
          invitation_last_sent_at?: string | null;
          invitation_send_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          created_by?: string | null;
          invitation_last_sent_at?: string | null;
          invitation_send_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_statistics_settings: {
        Row: {
          organization_id: string;
          kindertraining_default_from: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          kindertraining_default_from?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          kindertraining_default_from?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      performance_athlete_availability: {
        Row: {
          id: string;
          organization_id: string;
          group_id: string;
          athlete_id: string;
          training_date: string;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from: string | null;
          available_until: string | null;
          comment: string | null;
          source: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          group_id: string;
          athlete_id: string;
          training_date: string;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          source?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          group_id?: string;
          athlete_id?: string;
          training_date?: string;
          status?: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          source?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      performance_group_settings: {
        Row: {
          organization_id: string;
          group_id: string;
          registration_deadline_weekday: number;
          registration_deadline_time: string;
          weeks_ahead: number;
          allow_late_registration: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          group_id: string;
          registration_deadline_weekday?: number;
          registration_deadline_time?: string;
          weeks_ahead?: number;
          allow_late_registration?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          group_id?: string;
          registration_deadline_weekday?: number;
          registration_deadline_time?: string;
          weeks_ahead?: number;
          allow_late_registration?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      performance_trainer_availability: {
        Row: {
          id: string;
          organization_id: string;
          group_id: string;
          trainer_id: string;
          training_date: string;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from: string | null;
          available_until: string | null;
          comment: string | null;
          source: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          group_id: string;
          trainer_id: string;
          training_date: string;
          status: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          source?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          group_id?: string;
          trainer_id?: string;
          training_date?: string;
          status?: Database["public"]["Enums"]["performance_availability_status"];
          available_from?: string | null;
          available_until?: string | null;
          comment?: string | null;
          source?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_group_assignments: {
        Row: {
          organization_id: string;
          trainer_id: string;
          group_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          trainer_id: string;
          group_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          trainer_id?: string;
          group_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          is_active: boolean;
          linked_user_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          is_active?: boolean;
          linked_user_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          is_active?: boolean;
          linked_user_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_attendance: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          athlete_id: string;
          status: Database["public"]["Enums"]["training_attendance_status"];
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          session_id: string;
          athlete_id: string;
          status?: Database["public"]["Enums"]["training_attendance_status"];
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          session_id?: string;
          athlete_id?: string;
          status?: Database["public"]["Enums"]["training_attendance_status"];
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_block_group_assignments: {
        Row: {
          organization_id: string;
          block_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          block_id: string;
          group_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          block_id?: string;
          group_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      training_block_items: {
        Row: {
          id: string;
          organization_id: string;
          block_id: string;
          exercise_id: string;
          sort_order: number;
          note: string | null;
          parameter_values: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          block_id: string;
          exercise_id: string;
          sort_order: number;
          note?: string | null;
          parameter_values?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          block_id?: string;
          exercise_id?: string;
          sort_order?: number;
          note?: string | null;
          parameter_values?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_block_usages: {
        Row: {
          id: string;
          organization_id: string;
          block_id: string;
          source_type: string;
          source_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          block_id: string;
          source_type: string;
          source_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          block_id?: string;
          source_type?: string;
          source_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      training_block_user_favorites: {
        Row: {
          organization_id: string;
          block_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          block_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          block_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      training_block_versions: {
        Row: {
          id: string;
          organization_id: string;
          block_id: string;
          version_number: number;
          reason: string;
          snapshot: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          block_id: string;
          version_number: number;
          reason?: string;
          snapshot: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          block_id?: string;
          version_number?: number;
          reason?: string;
          snapshot?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      training_blocks: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          goal: string | null;
          description: string | null;
          estimated_minutes: number | null;
          is_active: boolean;
          variant_parent_id: string | null;
          variant_root_id: string | null;
          variant_number: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          goal?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          is_active?: boolean;
          variant_parent_id?: string | null;
          variant_root_id?: string | null;
          variant_number?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          goal?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          is_active?: boolean;
          variant_parent_id?: string | null;
          variant_root_id?: string | null;
          variant_number?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_groups: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          short_name: string | null;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          module_key: string | null;
          regular_weekdays: number[];
          allow_special_training: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          short_name?: string | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          module_key?: string | null;
          regular_weekdays?: number[];
          allow_special_training?: boolean;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          short_name?: string | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          module_key?: string | null;
          regular_weekdays?: number[];
          allow_special_training?: boolean;
        };
        Relationships: [];
      };
      training_module_statistics_settings: {
        Row: {
          organization_id: string;
          module_key: string;
          default_from: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          module_key: string;
          default_from?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          module_key?: string;
          default_from?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_session_trainers: {
        Row: {
          organization_id: string;
          session_id: string;
          trainer_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          session_id: string;
          trainer_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          session_id?: string;
          trainer_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      training_sessions: {
        Row: {
          id: string;
          organization_id: string;
          group_id: string;
          session_date: string;
          state: Database["public"]["Enums"]["training_session_state"];
          note: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          is_special: boolean;
          environment: Database["public"]["Enums"]["training_environment"] | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          group_id: string;
          session_date: string;
          state?: Database["public"]["Enums"]["training_session_state"];
          note?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_special?: boolean;
          environment?: Database["public"]["Enums"]["training_environment"] | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          group_id?: string;
          session_date?: string;
          state?: Database["public"]["Enums"]["training_session_state"];
          note?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_special?: boolean;
          environment?: Database["public"]["Enums"]["training_environment"] | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      capture_training_block_version: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
          p_reason?: string;
        };
        Returns: number;
      };
      create_training_block_variant: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
        };
        Returns: string;
      };
      exercise_catalog_overview_v3: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      exercise_catalog_overview_v4: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      exercise_usage_overview: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
        };
        Returns: Json;
      };
      exercise_duplicate_candidates: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string | null;
          p_name: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      normalize_catalog_name: {
        Args: {
          p_value: string;
        };
        Returns: string;
      };
      save_exercise_catalog_item_v4: {
        Args: {
          p_organization_id: string;
          p_exercise_id?: string | null;
          p_name?: string | null;
          p_category_key?: string | null;
          p_subcategory?: string | null;
          p_goal?: string | null;
          p_description?: string | null;
          p_coaching_cues?: string | null;
          p_common_mistakes?: string | null;
          p_equipment?: string[];
          p_video_url?: string | null;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_parameters?: Json;
          p_difficulty_key?: string | null;
          p_similar_exercise_ids?: string[];
          p_lock_token?: string | null;
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_training_block_v3: {
        Args: {
          p_organization_id: string;
          p_block_id?: string | null;
          p_name?: string | null;
          p_goal?: string | null;
          p_description?: string | null;
          p_estimated_minutes?: number | null;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_items?: Json;
          p_lock_token?: string | null;
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      seed_exercise_difficulties_for_organization: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      set_exercise_normalized_name: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      set_training_block_favorite: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
          p_is_favorite: boolean;
        };
        Returns: undefined;
      };
      training_block_overview_v3: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      training_block_overview_v4: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      training_block_versions_overview: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
        };
        Returns: Json;
      };
      audit_member_link_change: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      acquire_edit_lock: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_lock_token: string;
          p_force?: boolean;
          p_ttl_seconds?: number;
        };
        Returns: Json;
      };
      activate_current_memberships: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      admin_member_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          membership_id: string;
          user_id: string;
          email: string;
          display_name: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["membership_status"];
          email_confirmed_at: string;
          last_sign_in_at: string;
          created_at: string;
          permissions: Json;
        }>;
      };
      admin_member_overview_v2: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          membership_id: string;
          user_id: string;
          email: string;
          display_name: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["membership_status"];
          email_confirmed_at: string | null;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
          invitation_last_sent_at: string | null;
          invitation_send_count: number;
          linked_athlete_id: string | null;
          linked_athlete_name: string | null;
          linked_trainer_id: string | null;
          linked_trainer_name: string | null;
          permissions: Json;
        }>;
      };
      admin_member_overview_v3: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          membership_id: string;
          user_id: string;
          email: string;
          display_name: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["membership_status"];
          email_confirmed_at: string | null;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
          invitation_last_sent_at: string | null;
          invitation_send_count: number;
          linked_athletes: Json;
          linked_trainer_id: string | null;
          linked_trainer_name: string | null;
          permissions: Json;
        }>;
      };
      admin_member_link_options: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      admin_member_audit_overview: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
        };
        Returns: Array<{
          audit_id: number;
          actor_display_name: string;
          action: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        }>;
      };
      admin_update_organization_member: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
          p_display_name: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["membership_status"];
          p_permissions: Json;
        };
        Returns: undefined;
      };
      admin_member_invitation_target: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
          p_actor_user_id: string;
        };
        Returns: Array<{
          user_id: string;
          email: string;
          status: Database["public"]["Enums"]["membership_status"];
          email_confirmed_at: string | null;
          invitation_last_sent_at: string | null;
          invitation_send_count: number;
        }>;
      };
      admin_update_organization_member_v2: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
          p_display_name: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["membership_status"];
          p_permissions: Json;
          p_linked_athlete_id: string | null;
          p_linked_trainer_id: string | null;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      admin_update_organization_member_v3: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
          p_display_name: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["membership_status"];
          p_permissions: Json;
          p_linked_athlete_ids: string[];
          p_linked_trainer_id: string | null;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      apply_athlete_import_v1: {
        Args: {
          p_organization_id: string;
          p_import_id: string;
          p_rows: Json;
        };
        Returns: Json;
      };
      apply_exercise_import_v1: {
        Args: {
          p_organization_id: string;
          p_import_id: string;
          p_rows: Json;
          p_missing_options?: Json;
        };
        Returns: Json;
      };
      apply_performance_athlete_defaults: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_athlete_id: string;
          p_week_start: string;
        };
        Returns: undefined;
      };
      assert_edit_lock: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_lock_token: string;
          p_expected_updated_at?: string | null;
        };
        Returns: string;
      };
      assert_edit_lock_for_write: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: string;
      };
      athlete_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          first_name: string;
          last_name: string;
          birth_year: number;
          notes: string;
          is_active: boolean;
          linked_user_id: string;
          created_at: string;
          updated_at: string;
          groups: Json;
          contacts: Json;
        }>;
      };
      bootstrap_first_organization: {
        Args: {
          p_organization_name: string;
          p_organization_slug: string;
          p_display_name?: string;
        };
        Returns: string;
      };
      can_access_training_documentation_session: {
        Args: {
          p_organization_id: string;
          p_session_id: string;
          p_write?: boolean;
        };
        Returns: boolean;
      };
      can_edit_athlete_data: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_edit_kindertraining: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_edit_kindertraining_statistics: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_edit_training_module: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
        };
        Returns: boolean;
      };
      can_edit_training_module_statistics: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
        };
        Returns: boolean;
      };
      assert_import_entity_available: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_expected_updated_at: string;
        };
        Returns: undefined;
      };
      can_manage_performance_registration: {
        Args: {
          p_organization_id: string;
        };
        Returns: boolean;
      };
      can_read_athlete_data: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_read_kindertraining: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_read_kindertraining_statistics: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_read_training_module: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
        };
        Returns: boolean;
      };
      can_read_training_module_statistics: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
        };
        Returns: boolean;
      };
      cleanup_expired_edit_locks: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      copy_athlete_training_plan: {
        Args: {
          p_organization_id: string;
          p_source_plan_id: string;
          p_target_athlete_ids: string[];
          p_overwrite_existing?: boolean;
        };
        Returns: Json;
      };
      copy_performance_previous_week: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_athlete_id: string;
          p_week_start: string;
        };
        Returns: undefined;
      };
      create_athlete: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_group_ids?: string[];
        };
        Returns: string;
      };
      create_athlete_v2: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_group_ids?: string[];
          p_contacts?: Json;
        };
        Returns: string;
      };
      create_athlete_v3: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_group_ids?: string[];
          p_contacts?: Json;
          p_linked_user_id?: string;
        };
        Returns: string;
      };
      create_kindertraining_athlete: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year: number;
          p_session_date?: string;
          p_attach_existing?: boolean;
        };
        Returns: Json;
      };
      create_trainer: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
        };
        Returns: string;
      };
      create_trainer_v2: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
          p_group_ids?: string[];
        };
        Returns: string;
      };
      create_trainer_v3: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
          p_group_ids?: string[];
          p_linked_user_id?: string;
        };
        Returns: string;
      };
      create_training_group: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_sort_order?: number;
        };
        Returns: string;
      };
      create_training_group_v2: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_sort_order?: number;
          p_module_key?: string;
          p_regular_weekdays?: number[];
          p_allow_special_training?: boolean;
        };
        Returns: string;
      };
      create_training_group_v3: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_sort_order?: number;
          p_module_key?: string;
          p_regular_weekdays?: number[];
          p_allow_special_training?: boolean;
          p_is_performance_group?: boolean;
          p_registration_deadline_weekday?: number;
          p_registration_deadline_time?: string;
          p_performance_weeks_ahead?: number;
          p_allow_late_registration?: boolean;
        };
        Returns: string;
      };
      create_training_module_athlete: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year: number;
          p_session_date?: string;
          p_attach_existing?: boolean;
        };
        Returns: Json;
      };
      current_organization_role: {
        Args: {
          p_organization_id: string;
        };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      deactivate_training_module_athlete: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_group_id: string;
          p_athlete_id: string;
        };
        Returns: undefined;
      };
      delete_exercise_video_record: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
          p_video_id: string;
        };
        Returns: undefined;
      };
      delete_kindertraining_special_session: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_session_date: string;
        };
        Returns: Json;
      };
      delete_training_documentation_media: {
        Args: {
          p_organization_id: string;
          p_media_id: string;
        };
        Returns: string;
      };
      delete_training_module_special_session: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_group_id: string;
          p_session_date: string;
        };
        Returns: Json;
      };
      delete_unused_training_block: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
        };
        Returns: undefined;
      };
      dropdown_settings_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      duplicate_training_block: {
        Args: {
          p_organization_id: string;
          p_block_id: string;
        };
        Returns: string;
      };
      edit_lock_module_key: {
        Args: {
          p_entity_type: string;
        };
        Returns: string | null;
      };
      edit_lock_record_version: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
        };
        Returns: string;
      };
      exercise_catalog_overview: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      exercise_catalog_overview_v2: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      exercise_video_overview: {
        Args: {
          p_organization_id: string;
          p_exercise_id?: string;
        };
        Returns: Json;
      };
      handle_new_auth_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      has_module_access: {
        Args: {
          target_organization_id: string;
          target_module_key: string;
          require_edit?: boolean;
        };
        Returns: boolean;
      };
      is_active_org_member: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      is_app_initialized: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_attendance_training_module: {
        Args: {
          p_module_key: string;
        };
        Returns: boolean;
      };
      is_org_admin: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      kindertraining_configuration_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      kindertraining_group_trainer_ids: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
        };
        Returns: Json;
      };
      kindertraining_session_overview: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_session_date: string;
        };
        Returns: Json;
      };
      kindertraining_statistics_overview: {
        Args: {
          p_organization_id: string;
          p_from_date?: string;
          p_to_date?: string;
          p_session_limit?: number;
        };
        Returns: Json;
      };
      organization_linkable_users: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      performance_group_week_overview: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_week_start: string;
        };
        Returns: Json;
      };
      performance_registration_context: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      performance_registration_deadline: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_training_date: string;
        };
        Returns: string;
      };
      provision_organization_member: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
          p_display_name: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["membership_status"];
          p_permissions: Json;
          p_created_by: string;
        };
        Returns: string;
      };
      provision_organization_member_v2: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
          p_display_name: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["membership_status"];
          p_permissions: Json;
          p_created_by: string;
          p_invitation_sent_at?: string | null;
        };
        Returns: string;
      };
      record_member_invitation_sent: {
        Args: {
          p_organization_id: string;
          p_membership_id: string;
          p_actor_user_id: string;
          p_is_resend?: boolean;
        };
        Returns: Json;
      };
      release_edit_lock: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_lock_token: string;
        };
        Returns: boolean;
      };
      renew_edit_lock: {
        Args: {
          p_organization_id: string;
          p_entity_type: string;
          p_entity_id: string;
          p_lock_token: string;
          p_ttl_seconds?: number;
        };
        Returns: Json;
      };
      register_exercise_video: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
          p_storage_path: string;
          p_title: string;
          p_mime_type: string;
          p_file_size: number;
        };
        Returns: string;
      };
      register_training_documentation_media: {
        Args: {
          p_organization_id: string;
          p_session_id: string;
          p_item_id: string;
          p_storage_path: string;
          p_title: string;
          p_mime_type: string;
          p_file_size: number;
        };
        Returns: string;
      };
      replace_athlete_contacts: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_contacts: Json;
        };
        Returns: undefined;
      };
      replace_current_athlete_groups: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_group_ids: string[];
        };
        Returns: undefined;
      };
      replace_member_permissions: {
        Args: {
          p_membership_id: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_permissions: Json;
        };
        Returns: undefined;
      };
      replace_trainer_group_assignments: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_group_ids?: string[];
        };
        Returns: undefined;
      };
      save_athlete_training_plan: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
          p_athlete_id: string;
          p_group_id: string;
          p_training_date: string;
          p_title: string;
          p_notes: string;
          p_sections: Json;
        };
        Returns: string;
      };
      save_athlete_training_plan_v2: {
        Args: {
          p_organization_id: string;
          p_plan_id: string | null;
          p_athlete_id: string;
          p_group_id: string;
          p_training_date: string;
          p_title: string;
          p_notes: string;
          p_sections: Json;
          p_lock_token: string | null;
          p_expected_updated_at: string | null;
        };
        Returns: Json;
      };
      save_dropdown_setting: {
        Args: {
          p_organization_id: string;
          p_list_key: string;
          p_option_id?: string;
          p_option_key?: string;
          p_label?: string;
          p_unit?: string;
          p_input_type?: string;
          p_step_value?: number;
          p_sort_order?: number;
        };
        Returns: string;
      };
      save_exercise_catalog_item: {
        Args: {
          p_organization_id: string;
          p_exercise_id?: string;
          p_name?: string;
          p_category_key?: string;
          p_subcategory?: string;
          p_goal?: string;
          p_description?: string;
          p_coaching_cues?: string;
          p_common_mistakes?: string;
          p_equipment?: string[];
          p_video_url?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_parameters?: Json;
        };
        Returns: string;
      };
      save_exercise_catalog_item_v2: {
        Args: {
          p_organization_id: string;
          p_exercise_id?: string;
          p_name?: string;
          p_category_key?: string;
          p_subcategory?: string;
          p_goal?: string;
          p_description?: string;
          p_coaching_cues?: string;
          p_common_mistakes?: string;
          p_equipment?: string[];
          p_video_url?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_parameters?: Json;
        };
        Returns: string;
      };
      save_exercise_catalog_item_v3: {
        Args: {
          p_organization_id: string;
          p_exercise_id?: string | null;
          p_name?: string | null;
          p_category_key?: string | null;
          p_subcategory?: string | null;
          p_goal?: string | null;
          p_description?: string | null;
          p_coaching_cues?: string | null;
          p_common_mistakes?: string | null;
          p_equipment?: string[];
          p_video_url?: string | null;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_parameters?: Json;
          p_lock_token?: string | null;
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_kindertraining_session: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_session_date: string;
          p_state: Database["public"]["Enums"]["training_session_state"];
          p_note: string;
          p_attendance: Json;
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_kindertraining_session_v3: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_session_date: string;
          p_state: Database["public"]["Enums"]["training_session_state"];
          p_note: string;
          p_attendance: Json;
          p_trainer_ids: string[];
          p_environment: Database["public"]["Enums"]["training_environment"];
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_kindertraining_statistics_default: {
        Args: {
          p_organization_id: string;
          p_from_date: string;
        };
        Returns: string;
      };
      save_performance_athlete_availability: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_athlete_id: string;
          p_training_date: string;
          p_status: string;
          p_available_from?: string;
          p_available_until?: string;
          p_comment?: string;
        };
        Returns: Json;
      };
      save_performance_athlete_default: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_athlete_id: string;
          p_weekday: number;
          p_status: string;
          p_available_from?: string;
          p_available_until?: string;
          p_comment?: string;
        };
        Returns: undefined;
      };
      save_performance_group_settings: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_enabled: boolean;
          p_registration_deadline_weekday?: number;
          p_registration_deadline_time?: string;
          p_weeks_ahead?: number;
          p_allow_late_registration?: boolean;
        };
        Returns: undefined;
      };
      save_performance_trainer_availability: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_trainer_id: string;
          p_training_date: string;
          p_status: string;
          p_available_from?: string;
          p_available_until?: string;
          p_comment?: string;
        };
        Returns: Json;
      };
      save_training_block: {
        Args: {
          p_organization_id: string;
          p_block_id?: string;
          p_name?: string;
          p_goal?: string;
          p_description?: string;
          p_estimated_minutes?: number;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_items?: Json;
        };
        Returns: string;
      };
      save_training_block_v2: {
        Args: {
          p_organization_id: string;
          p_block_id?: string | null;
          p_name?: string | null;
          p_goal?: string | null;
          p_description?: string | null;
          p_estimated_minutes?: number | null;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_items?: Json;
          p_lock_token?: string | null;
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_training_documentation: {
        Args: {
          p_organization_id: string;
          p_session_id: string;
          p_status: string;
          p_actual_minutes: number;
          p_overall_rpe: number;
          p_overall_rating: number;
          p_overall_comment: string;
          p_pain_level: string;
          p_pain_comment: string;
          p_trainer_feedback: string;
          p_items: Json;
        };
        Returns: Json;
      };
      save_training_documentation_v2: {
        Args: {
          p_organization_id: string;
          p_session_id: string;
          p_status: string;
          p_actual_minutes: number;
          p_overall_rpe: number;
          p_overall_rating: number;
          p_overall_comment: string;
          p_pain_level: string;
          p_pain_comment: string;
          p_trainer_feedback: string;
          p_items: Json;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      save_training_documentation_v3: {
        Args: {
          p_organization_id: string;
          p_session_id: string;
          p_status: string;
          p_actual_minutes: number;
          p_overall_rpe: number;
          p_overall_rating: number;
          p_overall_comment: string;
          p_pain_level: string;
          p_pain_comment: string;
          p_trainer_feedback: string;
          p_items: Json;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      save_training_module_session: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_group_id: string;
          p_session_date: string;
          p_state: Database["public"]["Enums"]["training_session_state"];
          p_note: string;
          p_attendance: Json;
          p_trainer_ids: string[];
          p_environment: Database["public"]["Enums"]["training_environment"];
          p_expected_updated_at?: string | null;
        };
        Returns: Json;
      };
      save_training_module_statistics_default: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_from_date: string;
        };
        Returns: string;
      };
      set_athlete_user_link: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      set_dropdown_setting_active: {
        Args: {
          p_organization_id: string;
          p_list_key: string;
          p_option_id?: string;
          p_option_key?: string;
          p_is_active?: boolean;
        };
        Returns: undefined;
      };
      set_exercise_favorite: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
          p_is_favorite: boolean;
        };
        Returns: undefined;
      };
      set_exercise_primary_video: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
          p_video_id: string;
        };
        Returns: undefined;
      };
      set_trainer_user_link: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      start_training_documentation: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
        };
        Returns: string;
      };
      trainer_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      trainer_overview_v2: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      training_block_exercise_video_overview: {
        Args: {
          p_organization_id: string;
          p_exercise_id: string;
        };
        Returns: Json;
      };
      training_block_overview: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      training_block_overview_v2: {
        Args: {
          p_organization_id: string;
          p_include_inactive?: boolean;
        };
        Returns: Json;
      };
      training_documentation_detail: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
        };
        Returns: Json;
      };
      training_documentation_overview: {
        Args: {
          p_organization_id: string;
          p_week_start: string;
          p_group_id?: string;
          p_athlete_id?: string;
        };
        Returns: Json;
      };
      training_documentation_statistics: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_date_from: string;
          p_date_to: string;
        };
        Returns: Json;
      };
      training_group_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          name: string;
          short_name: string;
          description: string;
          is_active: boolean;
          sort_order: number;
          athlete_count: number;
          created_at: string;
          updated_at: string;
        }>;
      };
      training_group_overview_v2: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          name: string;
          short_name: string;
          description: string;
          is_active: boolean;
          sort_order: number;
          athlete_count: number;
          module_key: string;
          regular_weekdays: number[];
          allow_special_training: boolean;
          created_at: string;
          updated_at: string;
        }>;
      };
      training_group_overview_v3: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          name: string;
          short_name: string;
          description: string;
          is_active: boolean;
          sort_order: number;
          athlete_count: number;
          module_key: string;
          regular_weekdays: number[];
          allow_special_training: boolean;
          is_performance_group: boolean;
          registration_deadline_weekday: number;
          registration_deadline_time: string;
          performance_weeks_ahead: number;
          allow_late_registration: boolean;
          created_at: string;
          updated_at: string;
        }>;
      };
      training_module_configuration_overview: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
        };
        Returns: Json;
      };
      training_module_group_trainer_ids: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_group_id: string;
        };
        Returns: Json;
      };
      training_module_session_overview: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_group_id: string;
          p_session_date: string;
        };
        Returns: Json;
      };
      training_module_statistics_overview: {
        Args: {
          p_organization_id: string;
          p_module_key: string;
          p_from_date?: string;
          p_to_date?: string;
          p_session_limit?: number;
        };
        Returns: Json;
      };
      training_plan_detail: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
        };
        Returns: Json;
      };
      training_plan_week_overview: {
        Args: {
          p_organization_id: string;
          p_week_start: string;
          p_group_id?: string;
        };
        Returns: Json;
      };
      training_planning_overview: {
        Args: {
          p_organization_id: string;
          p_training_date: string;
          p_group_id?: string;
        };
        Returns: Json;
      };
      update_athlete: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
        };
        Returns: undefined;
      };
      update_athlete_v2: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_contacts?: Json;
        };
        Returns: undefined;
      };
      update_athlete_v3: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year?: number;
          p_notes?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_contacts?: Json;
          p_linked_user_id?: string;
        };
        Returns: undefined;
      };
      update_athlete_v4: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year: number | null;
          p_notes: string | null;
          p_is_active: boolean;
          p_group_ids: string[];
          p_contacts: Json;
          p_linked_user_id: string | null;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      update_trainer: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
          p_is_active?: boolean;
        };
        Returns: undefined;
      };
      update_trainer_v2: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
        };
        Returns: undefined;
      };
      update_trainer_v3: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string;
          p_email?: string;
          p_notes?: string;
          p_is_active?: boolean;
          p_group_ids?: string[];
          p_linked_user_id?: string;
        };
        Returns: undefined;
      };
      update_trainer_v4: {
        Args: {
          p_organization_id: string;
          p_trainer_id: string;
          p_first_name: string;
          p_last_name: string;
          p_phone: string | null;
          p_email: string | null;
          p_notes: string | null;
          p_is_active: boolean;
          p_group_ids: string[];
          p_linked_user_id: string | null;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
      update_training_group: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_is_active?: boolean;
          p_sort_order?: number;
        };
        Returns: undefined;
      };
      update_training_group_v2: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_is_active?: boolean;
          p_sort_order?: number;
          p_module_key?: string;
          p_regular_weekdays?: number[];
          p_allow_special_training?: boolean;
        };
        Returns: undefined;
      };
      update_training_group_v3: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_name: string;
          p_short_name?: string;
          p_description?: string;
          p_is_active?: boolean;
          p_sort_order?: number;
          p_module_key?: string;
          p_regular_weekdays?: number[];
          p_allow_special_training?: boolean;
          p_is_performance_group?: boolean;
          p_registration_deadline_weekday?: number;
          p_registration_deadline_time?: string;
          p_performance_weeks_ahead?: number;
          p_allow_late_registration?: boolean;
        };
        Returns: undefined;
      };
      update_training_group_v4: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_name: string;
          p_short_name: string | null;
          p_description: string | null;
          p_is_active: boolean;
          p_sort_order: number;
          p_module_key: string | null;
          p_regular_weekdays: number[];
          p_allow_special_training: boolean;
          p_is_performance_group: boolean;
          p_registration_deadline_weekday: number;
          p_registration_deadline_time: string;
          p_performance_weeks_ahead: number;
          p_allow_late_registration: boolean;
          p_lock_token: string;
          p_expected_updated_at: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "trainer" | "athlete" | "parent";
      membership_status: "invited" | "active" | "disabled";
      performance_availability_status: "coming" | "maybe" | "unavailable";
      training_attendance_status: "open" | "present" | "excused" | "absent";
      training_environment: "indoor" | "outdoor" | "mixed";
      training_session_state: "scheduled" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};

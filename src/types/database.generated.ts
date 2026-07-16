export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Update: Partial<Database["public"]["Tables"]["app_modules"]["Insert"]>;
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
          id?: never;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
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
        Update: Partial<
          Database["public"]["Tables"]["athlete_group_memberships"]["Insert"]
        >;
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
        };
        Update: Partial<Database["public"]["Tables"]["athletes"]["Insert"]>;
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
        Update: Partial<
          Database["public"]["Tables"]["member_module_permissions"]["Insert"]
        >;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
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
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
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
        };
        Update: Partial<
          Database["public"]["Tables"]["training_groups"]["Insert"]
        >;
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
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      athlete_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          first_name: string;
          last_name: string;
          birth_year: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          groups: Json;
        }>;
      };
      can_edit_athlete_data: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      can_read_athlete_data: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      create_athlete: {
        Args: {
          p_organization_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year: number | null;
          p_notes: string | null;
          p_group_ids: string[];
        };
        Returns: string;
      };
      create_training_group: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_short_name: string | null;
          p_description: string | null;
          p_sort_order: number;
        };
        Returns: string;
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
          email_confirmed_at: string | null;
          last_sign_in_at: string | null;
          created_at: string;
          permissions: Json;
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
      bootstrap_first_organization: {
        Args: {
          p_organization_name: string;
          p_organization_slug: string;
          p_display_name?: string;
        };
        Returns: string;
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
      is_org_admin: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      training_group_overview: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          id: string;
          name: string;
          short_name: string | null;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          athlete_count: number;
          created_at: string;
          updated_at: string;
        }>;
      };
      update_athlete: {
        Args: {
          p_organization_id: string;
          p_athlete_id: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_year: number | null;
          p_notes: string | null;
          p_is_active: boolean;
          p_group_ids: string[];
        };
        Returns: undefined;
      };
      update_training_group: {
        Args: {
          p_organization_id: string;
          p_group_id: string;
          p_name: string;
          p_short_name: string | null;
          p_description: string | null;
          p_is_active: boolean;
          p_sort_order: number;
        };
        Returns: undefined;
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
    };
    Enums: {
      app_role: "admin" | "trainer" | "athlete" | "parent";
      membership_status: "invited" | "active" | "disabled";
    };
    CompositeTypes: Record<string, never>;
  };
};

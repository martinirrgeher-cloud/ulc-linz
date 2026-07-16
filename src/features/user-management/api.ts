import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  InviteMemberInput,
  ManagedMember,
  ManagedModule,
  ManagedPermission,
  UpdateMemberInput,
} from "@/features/user-management/types";

type RawPermission = {
  module_key?: unknown;
  can_view?: unknown;
  can_edit?: unknown;
};

type InviteMemberResponse = {
  ok: boolean;
  invitationSent: boolean;
  existingAccount: boolean;
  status: "invited" | "active";
  message: string;
};

function parsePermissions(value: Json): ManagedPermission[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const permission = item as RawPermission;
    if (typeof permission.module_key !== "string") return [];

    const canEdit = permission.can_edit === true;
    return [
      {
        moduleKey: permission.module_key,
        canView: permission.can_view === true || canEdit,
        canEdit,
      },
    ];
  });
}

function toDatabasePermissions(permissions: ManagedPermission[]): Json {
  return permissions.map((permission) => ({
    module_key: permission.moduleKey,
    can_view: permission.canView || permission.canEdit,
    can_edit: permission.canEdit,
  }));
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: unknown };
        if (typeof body.error === "string" && body.error.trim()) return body.error;
      } catch {
        // Die Standardmeldung darunter ist hilfreicher als ein JSON-Parsefehler.
      }
    }
  }

  return error instanceof Error ? error.message : "Die Aktion ist fehlgeschlagen.";
}

export async function loadUserManagement(
  organizationId: string,
): Promise<{ members: ManagedMember[]; modules: ManagedModule[] }> {
  const supabase = requireSupabase();

  const [membersResult, modulesResult] = await Promise.all([
    supabase.rpc("admin_member_overview", {
      p_organization_id: organizationId,
    }),
    supabase
      .from("app_modules")
      .select("key, title, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (modulesResult.error) throw modulesResult.error;

  return {
    members: membersResult.data.map((member) => ({
      membershipId: member.membership_id,
      userId: member.user_id,
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      status: member.status,
      emailConfirmedAt: member.email_confirmed_at,
      lastSignInAt: member.last_sign_in_at,
      createdAt: member.created_at,
      permissions: parsePermissions(member.permissions),
    })),
    modules: modulesResult.data.map((module) => ({
      key: module.key,
      title: module.title,
      description: module.description,
      sortOrder: module.sort_order,
    })),
  };
}

export async function inviteMember(input: InviteMemberInput): Promise<InviteMemberResponse> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke<InviteMemberResponse>("invite-member", {
    body: input,
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.ok) throw new Error("Die Einladung wurde nicht bestätigt.");
  return data;
}

export async function updateMember(input: UpdateMemberInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("admin_update_organization_member", {
    p_organization_id: input.organizationId,
    p_membership_id: input.membershipId,
    p_display_name: input.displayName.trim(),
    p_role: input.role,
    p_status: input.status,
    p_permissions: toDatabasePermissions(input.permissions),
  });

  if (error) throw error;
}

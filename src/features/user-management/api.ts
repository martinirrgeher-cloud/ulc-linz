import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  InviteMemberInput,
  InvitationStatus,
  ManagedAthleteLink,
  ManagedMember,
  ManagedModule,
  ManagedPermission,
  MemberAthleteRelation,
  MemberAuditEntry,
  MemberLinkOption,
  MemberLinkOptions,
  MemberWarningCode,
  ResendInvitationInput,
  UpdateMemberInput,
} from "@/features/user-management/types";

type RawPermission = {
  module_key?: unknown;
  can_view?: unknown;
  can_edit?: unknown;
};

type RawLinkOption = {
  id?: unknown;
  name?: unknown;
  is_active?: unknown;
  linked_user_id?: unknown;
};

type RawAthleteLink = {
  id?: unknown;
  name?: unknown;
  is_active?: unknown;
  relation_type?: unknown;
};

type InviteMemberResponse = {
  ok: boolean;
  invitationSent: boolean;
  existingAccount: boolean;
  status: "invited" | "active";
  message: string;
};

type ResendInvitationResponse = {
  ok: boolean;
  message: string;
  sentAt: string;
  sendCount: number;
};

function parsePermissions(value: Json): ManagedPermission[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const permission = item as RawPermission;
    if (typeof permission.module_key !== "string") return [];

    const canEdit = permission.can_edit === true;
    return [{
      moduleKey: permission.module_key,
      canView: permission.can_view === true || canEdit,
      canEdit,
    }];
  });
}

function toDatabasePermissions(permissions: ManagedPermission[]): Json {
  return permissions.map((permission) => ({
    module_key: permission.moduleKey,
    can_view: permission.canView || permission.canEdit,
    can_edit: permission.canEdit,
  }));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseAthleteRelation(value: unknown): MemberAthleteRelation {
  return value === "self" ? "self" : "managed";
}

function parseAthleteLinks(value: Json): ManagedAthleteLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as RawAthleteLink;
    const id = stringValue(raw.id);
    const name = stringValue(raw.name);
    if (!id || !name) return [];
    return [{
      id,
      name,
      isActive: raw.is_active === true,
      relationType: parseAthleteRelation(raw.relation_type),
    }];
  });
}

function parseLinkOptions(value: Json): MemberLinkOptions {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  function parseList(list: unknown): MemberLinkOption[] {
    if (!Array.isArray(list)) return [];
    return list.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const raw = item as RawLinkOption;
      const id = stringValue(raw.id);
      const name = stringValue(raw.name);
      if (!id || !name) return [];
      return [{
        id,
        name,
        isActive: raw.is_active === true,
        linkedUserId: stringValue(raw.linked_user_id),
      }];
    });
  }

  return {
    athletes: parseList(data.athletes),
    trainers: parseList(data.trainers),
  };
}

function invitationStatus(
  status: ManagedMember["status"],
  emailConfirmedAt: string | null,
  invitationSendCount: number,
): InvitationStatus {
  if (status === "disabled") return "disabled";
  if (emailConfirmedAt) return "accepted";
  if (status === "invited" && invitationSendCount === 0) return "not_sent";
  if (status === "invited") return "open";
  return "not_required";
}

function memberWarnings(member: {
  role: ManagedMember["role"];
  status: ManagedMember["status"];
  emailConfirmedAt: string | null;
  invitationSendCount: number;
  linkedAthleteCount: number;
  linkedTrainerId: string | null;
}): MemberWarningCode[] {
  const warnings: MemberWarningCode[] = [];
  if (member.status === "invited" && member.invitationSendCount === 0) {
    warnings.push("invitation_not_sent");
  }
  if (member.status === "active" && !member.emailConfirmedAt) {
    warnings.push("email_not_confirmed");
  }
  if (member.role === "athlete" && member.linkedAthleteCount === 0) {
    warnings.push("athlete_link_missing");
  }
  if (member.role === "parent" && member.linkedAthleteCount === 0) {
    warnings.push("parent_link_missing");
  }
  if (member.role === "trainer" && !member.linkedTrainerId) {
    warnings.push("trainer_link_missing");
  }
  return warnings;
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

  if (error instanceof Error) {
    if (error.message.includes("Failed to send a request to the Edge Function")) {
      return "Die Einladungsfunktion ist nicht erreichbar. Prüfe, ob die Edge Function bereitgestellt und die aktuelle App-Adresse für CORS freigegeben ist.";
    }
    return error.message;
  }

  return "Die Aktion ist fehlgeschlagen.";
}

export async function loadUserManagement(
  organizationId: string,
): Promise<{
  members: ManagedMember[];
  modules: ManagedModule[];
  linkOptions: MemberLinkOptions;
}> {
  const supabase = requireSupabase();

  const [membersResult, modulesResult, linksResult] = await Promise.all([
    supabase.rpc("admin_member_overview_v3", {
      p_organization_id: organizationId,
    }),
    supabase
      .from("app_modules")
      .select("key, title, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.rpc("admin_member_link_options", {
      p_organization_id: organizationId,
    }),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (modulesResult.error) throw modulesResult.error;
  if (linksResult.error) throw linksResult.error;

  const members = membersResult.data.map((member) => {
    const invitationSendCount = member.invitation_send_count ?? 0;
    const linkedAthletes = parseAthleteLinks(member.linked_athletes);
    const linkedTrainerId = member.linked_trainer_id;
    const warningInput = {
      role: member.role,
      status: member.status,
      emailConfirmedAt: member.email_confirmed_at,
      invitationSendCount,
      linkedAthleteCount: linkedAthletes.length,
      linkedTrainerId,
    };

    return {
      membershipId: member.membership_id,
      userId: member.user_id,
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      status: member.status,
      emailConfirmedAt: member.email_confirmed_at,
      lastSignInAt: member.last_sign_in_at,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
      invitationLastSentAt: member.invitation_last_sent_at,
      invitationSendCount,
      invitationStatus: invitationStatus(
        member.status,
        member.email_confirmed_at,
        invitationSendCount,
      ),
      linkedAthletes,
      linkedTrainerId,
      linkedTrainerName: member.linked_trainer_name,
      warnings: memberWarnings(warningInput),
      permissions: parsePermissions(member.permissions),
    } satisfies ManagedMember;
  });

  return {
    members,
    modules: modulesResult.data.map((module) => ({
      key: module.key,
      title: module.title,
      description: module.description,
      sortOrder: module.sort_order,
    })),
    linkOptions: parseLinkOptions(linksResult.data),
  };
}

export async function loadMemberAudit(
  organizationId: string,
  membershipId: string,
): Promise<MemberAuditEntry[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("admin_member_audit_overview", {
    p_organization_id: organizationId,
    p_membership_id: membershipId,
  });
  if (error) throw error;
  return data.map((entry) => ({
    auditId: entry.audit_id,
    actorDisplayName: entry.actor_display_name,
    action: entry.action,
    beforeData: entry.before_data,
    afterData: entry.after_data,
    createdAt: entry.created_at,
  }));
}

export async function inviteMember(input: InviteMemberInput): Promise<InviteMemberResponse> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke<InviteMemberResponse>("invite-member", {
    body: { action: "invite", ...input },
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.ok) throw new Error("Die Einladung wurde nicht bestätigt.");
  return data;
}

export async function resendInvitation(
  input: ResendInvitationInput,
): Promise<ResendInvitationResponse> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke<ResendInvitationResponse>(
    "invite-member",
    { body: { action: "resend", ...input } },
  );

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.ok) throw new Error("Der erneute Versand wurde nicht bestätigt.");
  return data;
}

export async function updateMember(input: UpdateMemberInput): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("admin_update_organization_member_v3", {
    p_organization_id: input.organizationId,
    p_membership_id: input.membershipId,
    p_display_name: input.displayName.trim(),
    p_role: input.role,
    p_status: input.status,
    p_permissions: toDatabasePermissions(input.permissions),
    p_linked_athlete_ids: input.linkedAthleteIds,
    p_linked_trainer_id: input.linkedTrainerId,
    p_lock_token: input.editLock.lockToken,
    p_expected_updated_at: input.editLock.expectedUpdatedAt,
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Die gespeicherte Datensatzversion fehlt.");
  }
  const updatedAt = stringValue((data as Record<string, unknown>).updated_at);
  if (!updatedAt) throw new Error("Die gespeicherte Datensatzversion ist ungültig.");
  return updatedAt;
}

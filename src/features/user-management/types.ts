import type { AppRole } from "@/types/auth";
import type { Database, Json } from "@/types/database.generated";
import type { EditLockWriteGuard } from "@/features/collaboration/edit-locks";

export type MembershipStatus = Database["public"]["Enums"]["membership_status"];

export type ManagedModule = {
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type ManagedPermission = {
  moduleKey: string;
  canView: boolean;
  canEdit: boolean;
};

export type InvitationStatus =
  | "open"
  | "accepted"
  | "not_sent"
  | "not_required"
  | "disabled";

export type MemberWarningCode =
  | "invitation_not_sent"
  | "email_not_confirmed"
  | "athlete_link_missing"
  | "trainer_link_missing";

export type ManagedMember = {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  status: MembershipStatus;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
  invitationLastSentAt: string | null;
  invitationSendCount: number;
  invitationStatus: InvitationStatus;
  linkedAthleteId: string | null;
  linkedAthleteName: string | null;
  linkedTrainerId: string | null;
  linkedTrainerName: string | null;
  warnings: MemberWarningCode[];
  permissions: ManagedPermission[];
};

export type MemberLinkOption = {
  id: string;
  name: string;
  isActive: boolean;
  linkedUserId: string | null;
};

export type MemberLinkOptions = {
  athletes: MemberLinkOption[];
  trainers: MemberLinkOption[];
};

export type MemberAuditEntry = {
  auditId: number;
  actorDisplayName: string;
  action: string;
  beforeData: Json | null;
  afterData: Json | null;
  createdAt: string;
};

export type InviteMemberInput = {
  organizationId: string;
  email: string;
  displayName: string;
  role: AppRole;
  permissions: ManagedPermission[];
};

export type ResendInvitationInput = {
  organizationId: string;
  membershipId: string;
};

export type UpdateMemberInput = {
  organizationId: string;
  membershipId: string;
  displayName: string;
  role: AppRole;
  status: MembershipStatus;
  permissions: ManagedPermission[];
  linkedAthleteId: string | null;
  linkedTrainerId: string | null;
  editLock: EditLockWriteGuard;
};

import type { AppRole } from "@/types/auth";
import type { Database } from "@/types/database.generated";

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
  permissions: ManagedPermission[];
};

export type InviteMemberInput = {
  organizationId: string;
  email: string;
  displayName: string;
  role: AppRole;
  permissions: ManagedPermission[];
};

export type UpdateMemberInput = {
  organizationId: string;
  membershipId: string;
  displayName: string;
  role: AppRole;
  status: MembershipStatus;
  permissions: ManagedPermission[];
};

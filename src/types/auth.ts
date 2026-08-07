import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AppProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AppOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type AppMembership = {
  id: string;
  organizationId: string;
  role: AppRole;
};

export type ModulePermission = {
  moduleKey: string;
  canView: boolean;
  canEdit: boolean;
};

export type UserSimulationTarget = {
  membershipId: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  permissions: ModulePermission[];
  linkedAthleteIds: string[];
  linkedTrainerId: string | null;
};

export type UserSimulationState = UserSimulationTarget & {
  startedByDisplayName: string;
};

export type AppContext = {
  session: Session;
  authUser: User;
  profile: AppProfile | null;
  organization: AppOrganization | null;
  membership: AppMembership | null;
  permissions: ModulePermission[];
};

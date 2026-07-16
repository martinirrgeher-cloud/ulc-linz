import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type {
  AppContext,
  AppMembership,
  AppOrganization,
  AppProfile,
  ModulePermission,
} from "@/types/auth";

export type AuthState = {
  loading: boolean;
  contextLoading: boolean;
  configurationError: string | null;
  appContext: AppContext | null;
  isAuthenticated: boolean;
  isInitialized: boolean | null;
  needsBootstrap: boolean;
  accessError: string | null;
  canViewModule: (moduleKey: string) => boolean;
  canEditModule: (moduleKey: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  bootstrapOrganization: (name: string, slug: string, displayName: string) => Promise<void>;
  refreshContext: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [organization, setOrganization] = useState<AppOrganization | null>(null);
  const [membership, setMembership] = useState<AppMembership | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const configurationError = env.isSupabaseConfigured
    ? null
    : "Supabase ist noch nicht konfiguriert. Kopiere .env.example nach .env.local und trage URL sowie Publishable Key ein.";

  const clearAppData = useCallback(() => {
    setProfile(null);
    setOrganization(null);
    setMembership(null);
    setPermissions([]);
    setIsInitialized(null);
    setAccessError(null);
  }, []);

  const loadContext = useCallback(
    async (activeSession: Session | null) => {
      if (!supabase || !activeSession) {
        clearAppData();
        return;
      }

      setContextLoading(true);
      setAccessError(null);

      try {
        const userId = activeSession.user.id;

        const activationResult = await supabase.rpc("activate_current_memberships");
        if (activationResult.error) throw activationResult.error;

        const [profileResult, initializedResult, membershipResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase.rpc("is_app_initialized"),
          supabase
            .from("organization_members")
            .select("id, organization_id, role, status")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (initializedResult.error) throw initializedResult.error;
        if (membershipResult.error) throw membershipResult.error;

        setIsInitialized(initializedResult.data);

        setProfile(
          profileResult.data
            ? {
                id: profileResult.data.id,
                displayName: profileResult.data.display_name,
                avatarUrl: profileResult.data.avatar_url,
              }
            : null,
        );

        if (!membershipResult.data) {
          setOrganization(null);
          setMembership(null);
          setPermissions([]);
          if (initializedResult.data) {
            setAccessError(
              "Dein Benutzerkonto ist noch keinem aktiven Verein zugeordnet. Ein Administrator muss dich freischalten.",
            );
          }
          return;
        }

        const membershipData: AppMembership = {
          id: membershipResult.data.id,
          organizationId: membershipResult.data.organization_id,
          role: membershipResult.data.role,
        };
        setMembership(membershipData);

        const [organizationResult, permissionResult] = await Promise.all([
          supabase
            .from("organizations")
            .select("id, name, slug")
            .eq("id", membershipData.organizationId)
            .single(),
          supabase
            .from("member_module_permissions")
            .select("module_key, can_view, can_edit")
            .eq("membership_id", membershipData.id),
        ]);

        if (organizationResult.error) throw organizationResult.error;
        if (permissionResult.error) throw permissionResult.error;

        setOrganization({
          id: organizationResult.data.id,
          name: organizationResult.data.name,
          slug: organizationResult.data.slug,
        });

        setPermissions(
          permissionResult.data.map((permission) => ({
            moduleKey: permission.module_key,
            canView: permission.can_view,
            canEdit: permission.can_edit,
          })),
        );
      } catch (error) {
        clearAppData();
        setAccessError(errorMessage(error));
      } finally {
        setContextLoading(false);
      }
    },
    [clearAppData],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAccessError(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadContext(session);
  }, [loadContext, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [configurationError]);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
      if (!env.allowSelfSignup) {
        throw new Error("Die öffentliche Registrierung ist deaktiviert.");
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    },
    [configurationError],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearAppData();
  }, [clearAppData]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/passwort-neu`,
      });
      if (error) throw error;
    },
    [configurationError],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    [configurationError],
  );

  const bootstrapOrganization = useCallback(
    async (name: string, slug: string, displayName: string) => {
      if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
      const { error } = await supabase.rpc("bootstrap_first_organization", {
        p_organization_name: name.trim(),
        p_organization_slug: slug.trim().toLowerCase(),
        p_display_name: displayName.trim(),
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      await loadContext(data.session);
    },
    [configurationError, loadContext],
  );

  const canViewModule = useCallback(
    (moduleKey: string) => {
      if (!membership) return false;
      if (membership.role === "admin") return true;
      return permissions.some(
        (permission) => permission.moduleKey === moduleKey && permission.canView,
      );
    },
    [membership, permissions],
  );

  const canEditModule = useCallback(
    (moduleKey: string) => {
      if (!membership) return false;
      if (membership.role === "admin") return true;
      return permissions.some(
        (permission) => permission.moduleKey === moduleKey && permission.canEdit,
      );
    },
    [membership, permissions],
  );

  const appContext = useMemo<AppContext | null>(() => {
    if (!session) return null;
    return {
      session,
      authUser: session.user,
      profile,
      organization,
      membership,
      permissions,
    };
  }, [session, profile, organization, membership, permissions]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      contextLoading,
      configurationError,
      appContext,
      isAuthenticated: Boolean(session),
      isInitialized,
      needsBootstrap: Boolean(session && isInitialized === false && !membership),
      accessError,
      canViewModule,
      canEditModule,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      bootstrapOrganization,
      refreshContext: async () => loadContext(session),
    }),
    [
      loading,
      contextLoading,
      configurationError,
      appContext,
      session,
      isInitialized,
      membership,
      accessError,
      canViewModule,
      canEditModule,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      bootstrapOrganization,
      loadContext,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth muss innerhalb des AuthProvider verwendet werden.");
  return value;
}

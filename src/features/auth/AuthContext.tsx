import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  clearSensitiveSessionData,
  purgeSensitiveSessionData,
} from "@/lib/client-session-data";
import { supabase } from "@/lib/supabase";
import type {
  AppContext,
  AppMembership,
  AppOrganization,
  AppProfile,
  ModulePermission,
  UserSimulationState,
  UserSimulationTarget,
} from "@/types/auth";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import { setSimulationWriteGuard } from "@/features/simulation/simulation-guard";
export type ContextStatus =
  | "idle"
  | "loading"
  | "ready"
  | "offline"
  | "technical_error"
  | "no_membership";

export type AuthState = {
  loading: boolean;
  contextLoading: boolean;
  contextStatus: ContextStatus;
  contextError: string | null;
  sessionError: string | null;
  configurationError: string | null;
  appContext: AppContext | null;
  isAuthenticated: boolean;
  isInitialized: boolean | null;
  needsBootstrap: boolean;
  canViewModule: (moduleKey: string) => boolean;
  canEditModule: (moduleKey: string) => boolean;
  simulation: UserSimulationState | null;
  isSimulationActive: boolean;
  startSimulation: (target: UserSimulationTarget) => void;
  stopSimulation: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  bootstrapOrganization: (name: string, slug: string, displayName: string) => Promise<void>;
  refreshContext: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function rawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
}

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Ein unbekannter Fehler ist aufgetreten.", "auth");
}

function isInvalidSessionError(error: unknown): boolean {
  const message = rawErrorMessage(error).toLocaleLowerCase("de");
  return [
    "jwt expired",
    "invalid jwt",
    "auth session missing",
    "session missing",
    "refresh token",
    "token has expired",
    "not authenticated",
    "user from sub claim",
    "user not found",
    "user does not exist",
  ].some((fragment) => message.includes(fragment));
}

function authErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function isServerSessionRejected(error: unknown): boolean {
  const status = authErrorStatus(error);
  return status === 401 || isInvalidSessionError(error);
}

function connectionStatus(): Extract<ContextStatus, "offline" | "technical_error"> {
  return navigator.onLine ? "technical_error" : "offline";
}

const AUTH_INITIALIZATION_TIMEOUT_MS = 12_000;
const AUTH_RESTORE_ATTEMPTS = 3;
const CONTEXT_LOADING_TIMEOUT_MS = 15_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const contextRequestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextStatus, setContextStatus] = useState<ContextStatus>("idle");
  const [contextError, setContextError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [organization, setOrganization] = useState<AppOrganization | null>(null);
  const [membership, setMembership] = useState<AppMembership | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [simulation, setSimulation] = useState<UserSimulationState | null>(null);
  const simulationRef = useRef<UserSimulationState | null>(null);

  const configurationError = env.isSupabaseConfigured
    ? null
    : "Supabase ist noch nicht konfiguriert. Kopiere .env.example nach .env.local und trage URL sowie Publishable Key ein.";

  const clearAppData = useCallback(() => {
    contextRequestIdRef.current += 1;
    setProfile(null);
    setOrganization(null);
    setMembership(null);
    setPermissions([]);
    setIsInitialized(null);
    setContextLoading(false);
    setContextStatus("idle");
    setContextError(null);
    simulationRef.current = null;
    setSimulation(null);
    setSimulationWriteGuard(false);
  }, []);

  const loadContext = useCallback(
    async (activeSession: Session | null) => {
      // Während der Benutzer-Simulation bleibt der bereits geladene echte Admin-Kontext
      // unverändert. Dadurch werden auch Hintergrund-RPCs mit möglichen Seiteneffekten
      // (z. B. activate_current_memberships) nicht ausgeführt.
      if (simulationRef.current) return;

      if (!supabase || !activeSession) {
        clearAppData();
        return;
      }

      const requestId = contextRequestIdRef.current + 1;
      contextRequestIdRef.current = requestId;
      setContextLoading(true);
      setContextStatus("loading");
      setContextError(null);

      try {
        const userId = activeSession.user.id;

        const activationResult = await withTimeout(
          supabase.rpc("activate_current_memberships"),
          CONTEXT_LOADING_TIMEOUT_MS,
          "Die Vereinszuordnung konnte nicht rechtzeitig geladen werden.",
        );
        if (activationResult.error) throw activationResult.error;

        const [profileResult, initializedResult, membershipResult] = await withTimeout(
          Promise.all([
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
          ]),
          CONTEXT_LOADING_TIMEOUT_MS,
          "Benutzerprofil und Berechtigungen konnten nicht rechtzeitig geladen werden.",
        );

        if (profileResult.error) throw profileResult.error;
        if (initializedResult.error) throw initializedResult.error;
        if (membershipResult.error) throw membershipResult.error;
        if (requestId !== contextRequestIdRef.current) return;

        const nextProfile: AppProfile | null = profileResult.data
          ? {
              id: profileResult.data.id,
              displayName: profileResult.data.display_name,
              avatarUrl: profileResult.data.avatar_url,
            }
          : null;

        if (!membershipResult.data) {
          setProfile(nextProfile);
          setOrganization(null);
          setMembership(null);
          setPermissions([]);
          setIsInitialized(initializedResult.data);
          setContextStatus("no_membership");
          setContextError(
            initializedResult.data
              ? "Dein Benutzerkonto ist noch keinem aktiven Verein zugeordnet. Ein Administrator muss dich freischalten."
              : null,
          );
          return;
        }

        const nextMembership: AppMembership = {
          id: membershipResult.data.id,
          organizationId: membershipResult.data.organization_id,
          role: membershipResult.data.role,
        };

        const [organizationResult, permissionResult] = await withTimeout(
          Promise.all([
            supabase
              .from("organizations")
              .select("id, name, slug")
              .eq("id", nextMembership.organizationId)
              .single(),
            supabase
              .from("member_module_permissions")
              .select("module_key, can_view, can_edit")
              .eq("membership_id", nextMembership.id),
          ]),
          CONTEXT_LOADING_TIMEOUT_MS,
          "Verein und Modulrechte konnten nicht rechtzeitig geladen werden.",
        );

        if (organizationResult.error) throw organizationResult.error;
        if (permissionResult.error) throw permissionResult.error;
        if (requestId !== contextRequestIdRef.current) return;

        const nextOrganization: AppOrganization = {
          id: organizationResult.data.id,
          name: organizationResult.data.name,
          slug: organizationResult.data.slug,
        };
        const nextPermissions: ModulePermission[] = permissionResult.data.map((permission) => ({
          moduleKey: permission.module_key,
          canView: permission.can_view,
          canEdit: permission.can_edit,
        }));

        setProfile(nextProfile);
        setOrganization(nextOrganization);
        setMembership(nextMembership);
        setPermissions(nextPermissions);
        setIsInitialized(initializedResult.data);
        setContextStatus("ready");
        setContextError(null);
      } catch (error) {
        if (requestId !== contextRequestIdRef.current) return;

        if (isInvalidSessionError(error)) {
          clearSensitiveSessionData();
          sessionRef.current = null;
          setSession(null);
          clearAppData();
        } else {
          // Einen bereits gültig geladenen Vereinskontext nicht wegen eines
          // kurzfristigen Netzwerk- oder Supabase-Fehlers verwerfen. RLS bleibt
          // serverseitig die endgültige Berechtigungsinstanz.
          setContextStatus(connectionStatus());
          setContextError(errorMessage(error));
        }
      } finally {
        if (requestId === contextRequestIdRef.current) {
          setContextLoading(false);
        }
      }
    },
    [clearAppData],
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    purgeSensitiveSessionData();

    if (!supabase) {
      setLoading(false);
      return;
    }

    const authClient = supabase;
    let mounted = true;
    let recoveryRunning = false;

    async function restoreSession(initialLoad: boolean) {
      if (recoveryRunning) return;
      recoveryRunning = true;
      if (initialLoad) setLoading(true);

      let lastError: unknown = null;

      try {
        for (let attempt = 1; attempt <= AUTH_RESTORE_ATTEMPTS; attempt += 1) {
          try {
            const { data, error } = await withTimeout(
              authClient.auth.getSession(),
              AUTH_INITIALIZATION_TIMEOUT_MS,
              "Die gespeicherte Sitzung konnte nicht rechtzeitig geladen werden.",
            );
            if (error) throw error;
            if (!mounted) return;

            if (!data.session) {
              clearSensitiveSessionData();
              sessionRef.current = null;
              setSession(null);
              setSessionError(null);
              clearAppData();
              setLoading(false);
              return;
            }

            const {
              data: verifiedUserData,
              error: verifiedUserError,
            } = await withTimeout(
              authClient.auth.getUser(data.session.access_token),
              AUTH_INITIALIZATION_TIMEOUT_MS,
              "Die gespeicherte Anmeldung konnte nicht serverseitig bestätigt werden.",
            );

            if (verifiedUserError || !verifiedUserData.user) {
              const rejection = verifiedUserError ?? new Error("Der gespeicherte Benutzer existiert nicht mehr.");
              if (isServerSessionRejected(rejection)) {
                try {
                  await authClient.auth.signOut({ scope: "local" });
                } catch {
                  // Die lokale Sitzung wird unten unabhängig von einem Sign-out-Fehler verworfen.
                }
                if (!mounted) return;
                clearSensitiveSessionData();
                sessionRef.current = null;
                setSession(null);
                setSessionError(null);
                clearAppData();
                setLoading(false);
                return;
              }
              throw rejection;
            }

            if (verifiedUserData.user.id !== data.session.user.id) {
              try {
                await authClient.auth.signOut({ scope: "local" });
              } catch {
                // Die lokale Sitzung wird unten unabhängig von einem Sign-out-Fehler verworfen.
              }
              if (!mounted) return;
              clearSensitiveSessionData();
              sessionRef.current = null;
              setSession(null);
              setSessionError(null);
              clearAppData();
              setLoading(false);
              return;
            }

            const verifiedSession: Session = {
              ...data.session,
              user: verifiedUserData.user,
            };
            const previousUserId = sessionRef.current?.user.id ?? null;
            const nextUserId = verifiedSession.user.id;
            if (previousUserId && previousUserId !== nextUserId) {
              clearSensitiveSessionData();
              clearAppData();
            }

            purgeSensitiveSessionData(nextUserId);
            sessionRef.current = verifiedSession;
            setSession(verifiedSession);
            setSessionError(null);
            setLoading(false);
            return;
          } catch (error) {
            lastError = error;
            if (isInvalidSessionError(error)) {
              if (!mounted) return;
              clearSensitiveSessionData();
              sessionRef.current = null;
              setSession(null);
              setSessionError(null);
              clearAppData();
              setLoading(false);
              return;
            }
            if (attempt < AUTH_RESTORE_ATTEMPTS) {
              await wait(900 * attempt);
            }
          }
        }

        if (!mounted) return;
        setSessionError(
          `${errorMessage(lastError)} Die Sitzung wird beim nächsten Online-Kontakt erneut geprüft.`,
        );
        setLoading(false);
      } finally {
        recoveryRunning = false;
      }
    }

    void restoreSession(true);

    const { data: subscription } = authClient.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      // INITIAL_SESSION stammt aus dem lokalen Browser-Speicher und ist noch
      // nicht serverseitig bestätigt. restoreSession() validiert sie bewusst
      // mit auth.getUser(), bevor die App sie als Anmeldung akzeptiert.
      if (event === "INITIAL_SESSION") return;

      if (nextSession) {
        const previousUserId = sessionRef.current?.user.id ?? null;
        if (previousUserId && previousUserId !== nextSession.user.id) {
          clearSensitiveSessionData();
          clearAppData();
        }
        purgeSensitiveSessionData(nextSession.user.id);
        sessionRef.current = nextSession;
        setSession(nextSession);
        setSessionError(null);
        setLoading(false);
        return;
      }

      clearSensitiveSessionData();
      sessionRef.current = null;
      setSession(null);
      setSessionError(null);
      clearAppData();
      setLoading(false);
    });

    const recoverWhenActive = () => {
      if (document.visibilityState === "visible") {
        void restoreSession(false);
      }
    };

    const recoverWhenOnline = () => void restoreSession(false);
    const recoverFromPageCache = () => void restoreSession(false);

    document.addEventListener("visibilitychange", recoverWhenActive);
    window.addEventListener("online", recoverWhenOnline);
    window.addEventListener("pageshow", recoverFromPageCache);
    window.addEventListener("focus", recoverWhenOnline);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", recoverWhenActive);
      window.removeEventListener("online", recoverWhenOnline);
      window.removeEventListener("pageshow", recoverFromPageCache);
      window.removeEventListener("focus", recoverWhenOnline);
      subscription.subscription.unsubscribe();
    };
  }, [clearAppData]);

  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    // Token-Erneuerungen und die Rückkehr aus der Handy-Galerie liefern ein neues
    // Session-Objekt für denselben Benutzer. Der Vereinskontext muss dabei nicht
    // neu geladen werden, weil ProtectedRoute sonst die aktuelle Seite aushängt
    // und lokale Eingaben wie die ausgewählte Videodatei verloren gehen.
    void loadContext(sessionRef.current);
  }, [loadContext, sessionUserId]);

  useEffect(() => {
    const retryFailedContext = () => {
      if (
        sessionRef.current &&
        (contextStatus === "offline" || contextStatus === "technical_error")
      ) {
        void loadContext(sessionRef.current);
      }
    };

    window.addEventListener("online", retryFailedContext);
    window.addEventListener("pageshow", retryFailedContext);
    window.addEventListener("focus", retryFailedContext);

    return () => {
      window.removeEventListener("online", retryFailedContext);
      window.removeEventListener("pageshow", retryFailedContext);
      window.removeEventListener("focus", retryFailedContext);
    };
  }, [contextStatus, loadContext]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(configurationError ?? "Supabase fehlt.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSessionError(null);
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
    if (!supabase) {
      clearSensitiveSessionData();
      return;
    }

    const { error } = await supabase.auth.signOut();
    clearSensitiveSessionData();
    sessionRef.current = null;
    setSession(null);
    setSessionError(null);
    clearAppData();
    if (error) throw error;
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

  const startSimulation = useCallback((target: UserSimulationTarget) => {
    if (!membership || membership.role !== "admin") {
      throw new Error("Nur Administratoren können eine Benutzeransicht simulieren.");
    }
    if (!organization || target.organizationId !== organization.id) {
      throw new Error("Der Benutzer gehört nicht zum aktuell geöffneten Verein.");
    }

    const nextSimulation: UserSimulationState = {
      ...target,
      startedByDisplayName: profile?.displayName || sessionRef.current?.user.email || "Administrator",
    };
    simulationRef.current = nextSimulation;
    setSimulation(nextSimulation);
    setSimulationWriteGuard(true, target.displayName);
  }, [membership, organization, profile?.displayName]);

  const stopSimulation = useCallback(() => {
    simulationRef.current = null;
    setSimulation(null);
    setSimulationWriteGuard(false);
  }, []);

  const effectiveMembership = useMemo<AppMembership | null>(() => {
    if (!simulation) return membership;
    return {
      id: simulation.membershipId,
      organizationId: simulation.organizationId,
      role: simulation.role,
    };
  }, [membership, simulation]);

  const effectivePermissions = simulation?.permissions ?? permissions;

  const canViewModule = useCallback(
    (moduleKey: string) => {
      if (!effectiveMembership) return false;
      if (effectiveMembership.role === "admin") return true;
      return effectivePermissions.some(
        (permission) => permission.moduleKey === moduleKey && permission.canView,
      );
    },
    [effectiveMembership, effectivePermissions],
  );

  const canEditModule = useCallback(
    (moduleKey: string) => {
      if (!effectiveMembership) return false;
      if (effectiveMembership.role === "admin") return true;
      return effectivePermissions.some(
        (permission) => permission.moduleKey === moduleKey && permission.canEdit,
      );
    },
    [effectiveMembership, effectivePermissions],
  );

  const appContext = useMemo<AppContext | null>(() => {
    if (!session) return null;

    if (simulation) {
      return {
        session,
        authUser: {
          ...session.user,
          id: simulation.userId,
          email: simulation.email,
          user_metadata: {
            ...session.user.user_metadata,
            display_name: simulation.displayName,
          },
        },
        profile: {
          id: simulation.userId,
          displayName: simulation.displayName,
          avatarUrl: null,
        },
        organization,
        membership: effectiveMembership,
        permissions: effectivePermissions,
      };
    }

    return {
      session,
      authUser: session.user,
      profile,
      organization,
      membership,
      permissions,
    };
  }, [effectiveMembership, effectivePermissions, membership, organization, permissions, profile, session, simulation]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      contextLoading,
      contextStatus,
      contextError,
      sessionError,
      configurationError,
      appContext,
      isAuthenticated: Boolean(session),
      isInitialized,
      needsBootstrap: Boolean(session && isInitialized === false && !membership),
      canViewModule,
      canEditModule,
      simulation,
      isSimulationActive: Boolean(simulation),
      startSimulation,
      stopSimulation,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      bootstrapOrganization,
      refreshContext: async () => loadContext(sessionRef.current),
    }),
    [
      loading,
      contextLoading,
      contextStatus,
      contextError,
      sessionError,
      configurationError,
      appContext,
      session,
      isInitialized,
      membership,
      canViewModule,
      canEditModule,
      simulation,
      startSimulation,
      stopSimulation,
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

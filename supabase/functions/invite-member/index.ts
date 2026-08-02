import { createClient, type User } from "npm:@supabase/supabase-js@2";

type AppRole = "admin" | "trainer" | "athlete" | "parent";

type PermissionInput = {
  moduleKey: string;
  canView: boolean;
  canEdit: boolean;
};

type IncomingRequest = {
  action?: "invite" | "resend";
  organizationId?: string;
  membershipId?: string;
  email?: string;
  displayName?: string;
  role?: AppRole;
  permissions?: PermissionInput[];
};

type InvitationTarget = {
  user_id: string;
  email: string;
  status: "invited" | "active" | "disabled";
  email_confirmed_at: string | null;
  invitation_last_sent_at: string | null;
  invitation_send_count: number;
};

const allowedRoles = new Set<AppRole>(["admin", "trainer", "athlete", "parent"]);

function getKeyFromDictionary(variableName: string, fallbackName: string): string {
  const dictionaryValue = Deno.env.get(variableName);
  if (dictionaryValue) {
    const parsed = JSON.parse(dictionaryValue) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }

  const fallback = Deno.env.get(fallbackName);
  if (fallback) return fallback;

  throw new Error(`Supabase-Schlüssel ${variableName} ist nicht verfügbar.`);
}

function getAllowedOrigins(): string[] {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured?.length
    ? configured
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = getAllowedOrigins();
  const responseOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePermissions(permissions: PermissionInput[]): Array<{
  module_key: string;
  can_view: boolean;
  can_edit: boolean;
}> {
  const unique = new Map<string, { module_key: string; can_view: boolean; can_edit: boolean }>();

  for (const permission of permissions) {
    if (!permission || typeof permission.moduleKey !== "string") continue;
    const moduleKey = permission.moduleKey.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(moduleKey)) continue;

    const canEdit = Boolean(permission.canEdit);
    const canView = Boolean(permission.canView) || canEdit;
    unique.set(moduleKey, {
      module_key: moduleKey,
      can_view: canView,
      can_edit: canEdit,
    });
  }

  return [...unique.values()];
}

function invitationRedirect(origin: string | null, allowedOrigins: string[]): string {
  const configuredRedirect = Deno.env.get("APP_INVITE_REDIRECT_URL")?.trim();
  const fallbackRedirect = origin ? `${origin}/passwort-neu` : undefined;
  const redirectTo = configuredRedirect || fallbackRedirect;

  if (!redirectTo) {
    throw new Error(
      "Für Einladungen fehlt APP_INVITE_REDIRECT_URL und die Anfrage enthält keine Herkunft.",
    );
  }

  const redirectOrigin = new URL(redirectTo).origin;
  if (!allowedOrigins.includes(redirectOrigin)) {
    throw new Error("Die konfigurierte Einladungsadresse ist nicht freigegeben.");
  }
  return redirectTo;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();

  if (origin && !allowedOrigins.includes(origin)) {
    return jsonResponse({ error: "Diese Herkunft ist für die Funktion nicht freigegeben." }, 403, null);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Nur POST-Anfragen sind erlaubt." }, 405, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL ist nicht verfügbar.");

    const publishableKey = getKeyFromDictionary("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = getKeyFromDictionary("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Eine gültige Anmeldung ist erforderlich." }, 401, origin);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const {
      data: { user: callingUser },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !callingUser) {
      return jsonResponse({ error: "Die Anmeldung ist ungültig oder abgelaufen." }, 401, origin);
    }

    const payload = (await request.json()) as IncomingRequest;
    const organizationId = typeof payload.organizationId === "string"
      ? payload.organizationId.trim()
      : "";

    if (!isUuid(organizationId)) {
      return jsonResponse({ error: "Die Vereins-ID ist ungültig." }, 400, origin);
    }

    const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_org_admin", {
      target_organization_id: organizationId,
    });
    if (adminCheckError) throw adminCheckError;
    if (!isAdmin) {
      return jsonResponse({ error: "Für diese Aktion fehlen die Administratorrechte." }, 403, origin);
    }

    if (payload.action === "resend") {
      const membershipId = typeof payload.membershipId === "string"
        ? payload.membershipId.trim()
        : "";
      if (!isUuid(membershipId)) {
        return jsonResponse({ error: "Die Benutzerzuordnung ist ungültig." }, 400, origin);
      }

      const { data: targetRows, error: targetError } = await adminClient.rpc(
        "admin_member_invitation_target",
        {
          p_organization_id: organizationId,
          p_membership_id: membershipId,
          p_actor_user_id: callingUser.id,
        },
      );
      if (targetError) throw targetError;

      const target = (targetRows?.[0] ?? null) as InvitationTarget | null;
      if (!target) {
        return jsonResponse({ error: "Die offene Einladung wurde nicht gefunden." }, 404, origin);
      }
      if (target.status !== "invited" || target.email_confirmed_at) {
        return jsonResponse({ error: "Für dieses Konto besteht keine offene Einladung." }, 409, origin);
      }

      if (target.invitation_last_sent_at) {
        const elapsed = Date.now() - Date.parse(target.invitation_last_sent_at);
        if (Number.isFinite(elapsed) && elapsed < 30_000) {
          return jsonResponse(
            { error: "Die Einladung wurde gerade erst versendet. Bitte versuche es später erneut." },
            429,
            origin,
          );
        }
      }

      const redirectTo = invitationRedirect(origin, allowedOrigins);
      const { error: resendError } = await adminClient.auth.resend({
        type: "signup",
        email: target.email,
        options: { emailRedirectTo: redirectTo },
      });
      if (resendError) throw resendError;

      const { data: recorded, error: recordError } = await adminClient.rpc(
        "record_member_invitation_sent",
        {
          p_organization_id: organizationId,
          p_membership_id: membershipId,
          p_actor_user_id: callingUser.id,
          p_is_resend: target.invitation_send_count > 0,
        },
      );
      if (recordError) throw recordError;

      const record = recorded && typeof recorded === "object" && !Array.isArray(recorded)
        ? recorded as Record<string, unknown>
        : {};

      return jsonResponse({
        ok: true,
        message: target.invitation_send_count > 0
          ? "Die Einladung wurde erneut versendet."
          : "Die Einladung wurde versendet.",
        sentAt: record.sent_at,
        sendCount: record.send_count,
      }, 200, origin);
    }

    const email = normalizeEmail(typeof payload.email === "string" ? payload.email : "");
    const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
    const role = payload.role;
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, 400, origin);
    }
    if (displayName.length < 2 || displayName.length > 120) {
      return jsonResponse({ error: "Der Anzeigename muss zwischen 2 und 120 Zeichen lang sein." }, 400, origin);
    }
    if (!role || !allowedRoles.has(role)) {
      return jsonResponse({ error: "Die ausgewählte Rolle ist ungültig." }, 400, origin);
    }

    let targetUser: User | null = null;
    let searchExhausted = false;
    const perPage = 1000;

    for (let page = 1; page <= 10; page += 1) {
      const { data: userPage, error: userListError } =
        await adminClient.auth.admin.listUsers({ page, perPage });
      if (userListError) throw userListError;

      targetUser = userPage.users.find(
        (user) => normalizeEmail(user.email ?? "") === email,
      ) ?? null;

      if (targetUser) break;
      if (userPage.users.length < perPage) {
        searchExhausted = true;
        break;
      }
    }

    if (!targetUser && !searchExhausted) {
      throw new Error("Die Benutzersuche wurde aus Sicherheitsgründen nach 10.000 Konten beendet.");
    }

    let invitationSent = false;
    let invitationSentAt: string | null = null;

    if (!targetUser) {
      const redirectTo = invitationRedirect(origin, allowedOrigins);
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { display_name: displayName },
          redirectTo,
        });

      if (inviteError) throw inviteError;
      if (!inviteData.user) throw new Error("Supabase hat kein Benutzerkonto zurückgegeben.");

      targetUser = inviteData.user;
      invitationSent = true;
      invitationSentAt = new Date().toISOString();
    }

    const membershipStatus = targetUser.email_confirmed_at ? "active" : "invited";
    const { error: provisionError } = await adminClient.rpc(
      "provision_organization_member_v2",
      {
        p_organization_id: organizationId,
        p_user_id: targetUser.id,
        p_display_name: displayName,
        p_role: role,
        p_status: membershipStatus,
        p_permissions: normalizePermissions(permissions),
        p_created_by: callingUser.id,
        p_invitation_sent_at: invitationSentAt,
      },
    );

    if (provisionError) {
      if (invitationSent) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(targetUser.id);
        if (cleanupError) console.error("invite-member cleanup failed", cleanupError);
      }
      throw provisionError;
    }

    return jsonResponse({
      ok: true,
      invitationSent,
      existingAccount: !invitationSent,
      status: membershipStatus,
      message: invitationSent
        ? "Die Einladung wurde versendet."
        : targetUser.email_confirmed_at
          ? "Das bestehende Supabase-Konto wurde dem Verein zugeordnet."
          : "Das bestehende unbestätigte Konto wurde zugeordnet. Sende die Einladung bei Bedarf erneut.",
    }, 200, origin);
  } catch (error) {
    console.error("invite-member failed", error);
    const message = error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
    return jsonResponse({ error: message }, 500, origin);
  }
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const env = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || "ULC Linz Oberbank",
  supabaseUrl,
  supabasePublishableKey,
  allowSelfSignup:
    (import.meta.env.VITE_ALLOW_SELF_SIGNUP ?? "false").toLowerCase() === "true",
  isSupabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  appVersion: __APP_VERSION__,
  appCommit: __APP_COMMIT__,
  appBuildTime: __APP_BUILD_TIME__,
  appBuildLabel: `v${__APP_VERSION__} · ${__APP_COMMIT__}`,
} as const;

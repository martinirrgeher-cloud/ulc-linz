const SUPABASE_ORIGIN = "https://e2e.supabase.co";
const STORAGE_KEY = "sb-e2e-auth-token";

export const E2E_IDS = Object.freeze({
  user: "00000000-0000-0000-0000-00000000e2e1",
  organization: "10000000-0000-0000-0000-00000000e2e1",
  membership: "11000000-0000-0000-0000-00000000e2e1",
  group: "12000000-0000-0000-0000-00000000e2e1",
  athlete: "13000000-0000-0000-0000-00000000e2e1",
  exercise: "14000000-0000-0000-0000-00000000e2e1",
  block: "15000000-0000-0000-0000-00000000e2e1",
});

const moduleKeys = [
  "kindertraining",
  "u12",
  "u14",
  "kindertraining_statistics",
  "u12_statistics",
  "u14_statistics",
  "athletes",
  "performance_registration",
  "exercise_catalog",
  "training_planning",
  "training_overview",
  "training_blocks",
  "training_documentation",
  "dropdown_settings",
  "data_import",
  "user_management",
  "countdown",
];

const user = {
  id: E2E_IDS.user,
  aud: "authenticated",
  role: "authenticated",
  email: "e2e-admin@example.test",
  email_confirmed_at: "2026-08-01T08:00:00.000Z",
  confirmed_at: "2026-08-01T08:00:00.000Z",
  last_sign_in_at: "2026-08-02T08:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "E2E Administrator" },
  identities: [],
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
  is_anonymous: false,
};

function base64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

const accessToken = [
  base64Url({ alg: "none", typ: "JWT" }),
  base64Url({
    sub: E2E_IDS.user,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    exp: 4102444800,
    iat: 1785657600,
  }),
  "e2e",
].join(".");

const session = {
  access_token: accessToken,
  refresh_token: "e2e-refresh-token",
  expires_in: 2_316_787_200,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user,
};

const longExerciseName = "Beschleunigungslauf mit aktivem Kniehub und vollständiger Streckung";
const longBlockName = "Sprinttechnik mit koordinativem Schwerpunkt und sauberer Beschleunigungsphase";

const group = {
  id: E2E_IDS.group,
  name: "Leistungsgruppe Sprint und Mehrkampf",
  short_name: "LG Sprint",
  regular_weekdays: [1, 3, 5],
  is_performance_group: true,
};

const athlete = {
  id: E2E_IDS.athlete,
  first_name: "Anna",
  last_name: "Testathletin",
  group_ids: [E2E_IDS.group],
  registrations: [
    { date: "2026-08-03", status: "coming", comment: "", is_late: false },
  ],
};

const parameter = {
  parameter_key: "distance",
  label: "Distanz",
  unit: "m",
  input_type: "number",
  default_value: "30",
  min_value: 10,
  max_value: 100,
  step_value: 5,
  is_required: true,
  sort_order: 10,
};

const exercise = {
  id: E2E_IDS.exercise,
  name: longExerciseName,
  category_key: "sprint",
  category_title: "Sprint",
  subcategory: "Beschleunigung",
  goal: "Technisch saubere Beschleunigung",
  description: "Aufrechte Haltung vorbereiten und den Abdruck aktiv nach hinten führen.",
  coaching_cues: "Arme eng führen, Fuß aktiv unter dem Körperschwerpunkt aufsetzen.",
  common_mistakes: "Zu frühes Aufrichten und passiver Fußaufsatz.",
  equipment: ["Markierungshütchen"],
  video_url: null,
  is_active: true,
  is_favorite: true,
  group_ids: [E2E_IDS.group],
  parameters: [parameter],
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
};

const blockItem = {
  exercise_id: E2E_IDS.exercise,
  exercise_name: longExerciseName,
  category_title: "Sprint · Beschleunigung",
  note: null,
  parameter_values: { distance: "30" },
  parameters: [parameter],
};

const block = {
  id: E2E_IDS.block,
  name: longBlockName,
  goal: "Beschleunigung und Technik",
  description: "Technikorientierter Sprintblock.",
  estimated_minutes: 20,
  group_ids: [E2E_IDS.group],
  items: [blockItem],
  is_active: true,
  usage_count: 1,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
};

const rpcPayloads = new Map([
  ["activate_current_memberships", null],
  ["is_app_initialized", true],
  ["athlete_overview", []],
  ["training_group_overview_v3", [group]],
  ["trainer_overview_v2", []],
  ["organization_linkable_users", []],
  ["exercise_video_overview", []],
  ["exercise_catalog_overview_v2", {
    categories: [{ key: "sprint", title: "Sprint", sort_order: 10, is_active: true }],
    subcategories: [{ key: "beschleunigung", label: "Beschleunigung", sort_order: 10, is_active: true }],
    materials: [{ key: "markierungshuetchchen", label: "Markierungshütchen", sort_order: 10, is_active: true }],
    parameter_options: [parameter],
    groups: [group],
    exercises: [exercise],
  }],
  ["training_block_overview_v2", { groups: [group], exercises: [exercise], blocks: [block] }],
  ["training_plan_week_overview", {
    week_start: "2026-08-03",
    week_end: "2026-08-09",
    groups: [group],
    selected_group_id: E2E_IDS.group,
    dates: [
      { date: "2026-08-03", weekday: 1 },
      { date: "2026-08-05", weekday: 3 },
      { date: "2026-08-07", weekday: 5 },
    ],
    athletes: [athlete],
    plans: [],
  }],
  ["training_planning_overview", {
    groups: [group],
    athletes: [athlete],
    blocks: [block],
    exercises: [exercise],
    plans: [],
  }],
  ["admin_member_overview", []],
  ["dropdown_settings_overview", {
    category: [{ id: null, key: "sprint", label: "Sprint", sort_order: 10, is_active: true, usage_count: 1 }],
    subcategory: [],
    material: [],
    planning_parameter: [],
  }],
]);

function corsHeaders(contentType = "application/json") {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, range",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "content-type": contentType,
  };
}

function tablePayload(table, request) {
  const wantsObject = (request.headers()["accept"] || "").includes("application/vnd.pgrst.object+json");
  const single = (value) => wantsObject ? value : [value];

  switch (table) {
    case "profiles":
      return single({ id: E2E_IDS.user, display_name: "E2E Administrator", avatar_url: null });
    case "organization_members":
      return single({
        id: E2E_IDS.membership,
        organization_id: E2E_IDS.organization,
        user_id: E2E_IDS.user,
        role: "admin",
        status: "active",
        created_at: "2026-08-01T08:00:00.000Z",
      });
    case "organizations":
      return single({ id: E2E_IDS.organization, name: "ULC Linz E2E", slug: "ulc-linz-e2e" });
    case "member_module_permissions":
      return moduleKeys.map((moduleKey) => ({ module_key: moduleKey, can_view: true, can_edit: true }));
    case "app_modules":
      return moduleKeys.map((key, index) => ({
        key,
        title: key,
        description: "E2E-Modul",
        sort_order: (index + 1) * 10,
        is_active: true,
      }));
    default:
      return [];
  }
}

export async function installAuthenticatedSession(page) {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: session });
}

export async function installSupabaseMock(page) {
  const unhandled = [];

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders("text/plain"), body: "" });
      return;
    }

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, headers: corsHeaders(), body: JSON.stringify(user) });
      return;
    }

    if (url.pathname === "/auth/v1/logout") {
      await route.fulfill({ status: 204, headers: corsHeaders("text/plain"), body: "" });
      return;
    }

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const functionName = decodeURIComponent(url.pathname.slice("/rest/v1/rpc/".length));
      if (!rpcPayloads.has(functionName)) {
        unhandled.push(`${request.method()} ${url.pathname}`);
        await route.fulfill({
          status: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ message: `E2E RPC mock fehlt: ${functionName}` }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders(),
        body: JSON.stringify(rpcPayloads.get(functionName)),
      });
      return;
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders(), "content-range": "0-0/1" },
        body: JSON.stringify(tablePayload(table, request)),
      });
      return;
    }

    unhandled.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ message: `E2E Supabase mock fehlt: ${url.pathname}` }),
    });
  });

  return unhandled;
}

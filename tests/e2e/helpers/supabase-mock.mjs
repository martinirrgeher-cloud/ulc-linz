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
  simulatedUser: "00000000-0000-0000-0000-00000000e2e3",
  simulatedMembership: "11000000-0000-0000-0000-00000000e2e3",
  simulatedAdminUser: "00000000-0000-0000-0000-00000000e2e4",
  simulatedAdminMembership: "11000000-0000-0000-0000-00000000e2e4",
});

const moduleKeys = [
  "kindertraining",
  "u12",
  "u14",
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
  description: "Leistungsorientierte Sprintgruppe",
  is_active: true,
  sort_order: 10,
  athlete_count: 1,
  module_key: "u14",
  regular_weekdays: [1, 3, 5],
  allow_special_training: true,
  is_performance_group: true,
  registration_deadline_weekday: 7,
  registration_deadline_time: "18:00:00",
  performance_weeks_ahead: 4,
  allow_late_registration: true,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
};


const managementAthlete = {
  id: E2E_IDS.athlete,
  first_name: "Anna",
  last_name: "Testathletin",
  birth_year: 2012,
  notes: "Sprintgruppe",
  is_active: true,
  linked_user_id: null,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
  groups: [{
    id: E2E_IDS.group,
    name: group.name,
    short_name: group.short_name,
    is_active: true,
  }],
  contacts: [{
    id: "13000000-0000-0000-0000-00000000c001",
    contact_name: "Maria Test",
    relationship: "Mutter",
    phone: "+43 660 1234567",
    is_emergency: true,
    priority: 1,
    notes: "",
  }],
};

const managementTrainer = {
  id: "13000000-0000-0000-0000-00000000e2f1",
  first_name: "Thomas",
  last_name: "Testtrainer",
  phone: "+43 660 7654321",
  email: "trainer@example.test",
  notes: "Sprint und Mehrkampf",
  is_active: true,
  linked_user_id: null,
  group_ids: [E2E_IDS.group],
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
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

const catalogParameters = [
  parameter,
  { ...parameter, parameter_key: "repetitions", label: "Wiederholungen", unit: "", default_value: "6", sort_order: 20 },
  { ...parameter, parameter_key: "sets", label: "Sätze", unit: "", default_value: "3", sort_order: 30 },
  { ...parameter, parameter_key: "intensity", label: "Intensität", unit: "%", default_value: "80", sort_order: 40 },
  { ...parameter, parameter_key: "rest", label: "Pause", unit: "s", default_value: "45", sort_order: 50 },
];

const catalogParameterOptions = catalogParameters.map((item) => ({
  key: item.parameter_key,
  label: item.label,
  unit: item.unit,
  input_type: item.input_type,
  step_value: item.step_value,
  sort_order: item.sort_order,
  is_active: true,
}));

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
  video_url: "https://example.com/exercise-video",
  is_active: true,
  is_favorite: true,
  difficulty_key: "medium",
  difficulty_label: "Mittel",
  similar_exercise_ids: [],
  block_usage_count: 1,
  plan_usage_count: 1,
  last_used_at: "2026-08-01",
  group_ids: [E2E_IDS.group],
  parameters: catalogParameters,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
};

const blockItem = {
  id: "10000000-0000-4000-8000-000000000006",
  exercise_id: E2E_IDS.exercise,
  exercise_name: longExerciseName,
  exercise_is_active: true,
  category_title: "Sprint · Beschleunigung",
  sort_order: 1,
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
  is_favorite: true,
  variant_parent_id: null,
  variant_parent_name: null,
  variant_root_id: null,
  variant_number: 1,
  inactive_exercise_count: 0,
  last_used_at: "2026-08-01",
  used_group_ids: [E2E_IDS.group],
  version_count: 1,
  latest_version: {
    id: "10000000-0000-4000-8000-000000000007",
    version_number: 1,
    reason: "created",
    created_at: "2026-08-01T08:00:00.000Z",
  },
  usage_count: 1,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-02T08:00:00.000Z",
};



const performanceGroup = {
  id: E2E_IDS.group,
  name: group.name,
  short_name: group.short_name,
  regular_weekdays: group.regular_weekdays,
  deadline_weekday: group.registration_deadline_weekday,
  deadline_time: group.registration_deadline_time,
  weeks_ahead: group.performance_weeks_ahead,
  allow_late_registration: group.allow_late_registration,
};

const statisticsOverview = {
  default_from_date: "2026-01-01",
  from_date: "2026-01-01",
  to_date: "2026-08-04",
  summary: {
    session_count: 0,
    cancelled_count: 0,
    average_present: 0,
    max_present: 0,
    unique_present: 0,
  },
  sessions: [],
  athletes: [],
  trainers: [],
  monthly: [],
};

const rpcPayloads = new Map([
  ["activate_current_memberships", null],
  ["acquire_edit_lock", {
    acquired: true,
    lock_token: "00000000-0000-4000-8000-00000000e2e1",
    locked_by_user_id: E2E_IDS.user,
    locked_by_name: "E2E Administrator",
    acquired_at: "2026-08-05T06:00:00.000Z",
    expires_at: "2026-08-05T06:02:00.000Z",
    is_own_other_session: false,
    record_version: "2026-08-02T08:00:00.000Z",
    can_force: true,
  }],
  ["renew_edit_lock", { renewed: true }],
  ["release_edit_lock", null],
  ["assert_edit_lock", null],
  ["kindertraining_configuration_overview", { group, special_dates: [] }],
  ["kindertraining_group_trainer_ids", []],
  ["kindertraining_session_overview", { session: null, default_trainer_ids: [], default_environment: "outdoor", trainers: [], is_regular_day: true, participants: [{ athlete_id: E2E_IDS.athlete, first_name: "Anna", last_name: "Testathletin", birth_year: 2012, is_active: true, status: "open", contacts: [] }] }],
  ["training_module_configuration_overview", { group, special_dates: [] }],
  ["training_module_group_trainer_ids", []],
  ["training_module_session_overview", { session: null, default_trainer_ids: [], default_environment: "outdoor", trainers: [], is_regular_day: true, participants: [{ athlete_id: E2E_IDS.athlete, first_name: "Anna", last_name: "Testathletin", birth_year: 2012, is_active: true, status: "open", contacts: [] }] }],
  ["kindertraining_statistics_overview", statisticsOverview],
  ["training_module_statistics_overview", statisticsOverview],
  ["is_app_initialized", true],
  ["athlete_overview", [managementAthlete]],
  ["training_group_overview_v3", [group]],
  ["trainer_overview_v2", [managementTrainer]],
  ["organization_linkable_users", []],
  ["exercise_video_overview", [{
    id: "10000000-0000-4000-8000-000000000098",
    exercise_id: E2E_IDS.exercise,
    title: "Technikvideo",
    storage_path: "e2e/technikvideo.mp4",
    mime_type: "video/mp4",
    file_size: 1024,
    is_primary: true,
    created_at: "2026-08-01T08:00:00.000Z",
  }]],
  ["exercise_catalog_overview_v4", {
    categories: [{ key: "sprint", title: "Sprint", sort_order: 10, is_active: true }],
    subcategories: [{ key: "beschleunigung", label: "Beschleunigung", sort_order: 10, is_active: true }],
    materials: [{ key: "markierungshuetchchen", label: "Markierungshütchen", sort_order: 10, is_active: true }],
    difficulties: [{ key: "medium", label: "Mittel", sort_order: 30, is_active: true }],
    parameter_options: catalogParameterOptions,
    groups: [group],
    exercises: [exercise],
  }],
  ["exercise_usage_overview", {
    block_usages: [{ id: E2E_IDS.block, name: longBlockName, is_active: true }],
    plan_usages: [{
      id: "10000000-0000-4000-8000-000000000099",
      title: "Mobiler Testplan",
      training_date: "2026-08-05",
      via_block_name: null,
    }],
    last_used_at: "2026-08-01",
  }],
  ["training_block_overview_v4", { groups: [group], exercises: [exercise], blocks: [block] }],
  ["training_block_versions_overview", [{
    id: "10000000-0000-4000-8000-000000000007",
    version_number: 1,
    reason: "created",
    snapshot: {
      name: longBlockName,
      goal: "Beschleunigung und Technik",
      description: "Technikorientierter Sprintblock.",
      estimated_minutes: 20,
      is_active: true,
      group_ids: [E2E_IDS.group],
      items: [blockItem],
    },
    created_at: "2026-08-01T08:00:00.000Z",
  }]],
  ["performance_registration_context", {
    role: "admin",
    can_manage: true,
    athlete: null,
    trainer: null,
    groups: [performanceGroup],
  }],
  ["performance_group_week_overview", {
    week_start: "2026-08-03",
    week_end: "2026-08-09",
    group: performanceGroup,
    dates: [
      { date: "2026-08-03", weekday: 1, deadline_at: "2026-08-02T18:00:00.000Z" },
      { date: "2026-08-05", weekday: 3, deadline_at: "2026-08-04T18:00:00.000Z" },
      { date: "2026-08-07", weekday: 5, deadline_at: "2026-08-06T18:00:00.000Z" },
    ],
    athletes: [{
      id: E2E_IDS.athlete,
      first_name: "Anna",
      last_name: "Testathletin",
      is_active: true,
      birth_year: 2012,
      availability: [],
      defaults: [],
    }],
    trainers: [],
  }],
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
  ["training_documentation_overview", {
    week_start: "2026-08-03",
    week_end: "2026-08-09",
    current_role: "admin",
    own_athlete_id: null,
    can_review: true,
    groups: [group],
    athletes: [athlete],
    plans: [],
  }],
  ["admin_member_overview_v3", [
    {
      membership_id: E2E_IDS.membership,
      user_id: E2E_IDS.user,
      email: user.email,
      display_name: "E2E Administrator",
      role: "admin",
      status: "active",
      email_confirmed_at: "2026-08-01T08:00:00.000Z",
      last_sign_in_at: "2026-08-02T08:00:00.000Z",
      created_at: "2026-08-01T08:00:00.000Z",
      updated_at: "2026-08-02T08:00:00.000Z",
      invitation_last_sent_at: null,
      invitation_send_count: 0,
      linked_athletes: [],
      linked_trainer_id: null,
      linked_trainer_name: null,
      permissions: moduleKeys.map((moduleKey) => ({ module_key: moduleKey, can_view: true, can_edit: true })),
    },
    {
      membership_id: E2E_IDS.simulatedAdminMembership,
      user_id: E2E_IDS.simulatedAdminUser,
      email: "admin-simulation@example.test",
      display_name: "E2E Zweitadmin",
      role: "admin",
      status: "active",
      email_confirmed_at: "2026-08-03T07:00:00.000Z",
      last_sign_in_at: "2026-08-04T07:00:00.000Z",
      created_at: "2026-08-03T07:00:00.000Z",
      updated_at: "2026-08-04T07:00:00.000Z",
      invitation_last_sent_at: null,
      invitation_send_count: 0,
      linked_athletes: [],
      linked_trainer_id: null,
      linked_trainer_name: null,
      permissions: moduleKeys.map((moduleKey) => ({ module_key: moduleKey, can_view: true, can_edit: true })),
    },
    {
      membership_id: E2E_IDS.simulatedMembership,
      user_id: E2E_IDS.simulatedUser,
      email: "trainer-simulation@example.test",
      display_name: "E2E Trainer",
      role: "trainer",
      status: "active",
      email_confirmed_at: "2026-08-03T07:00:00.000Z",
      last_sign_in_at: "2026-08-04T07:00:00.000Z",
      created_at: "2026-08-03T07:00:00.000Z",
      updated_at: "2026-08-04T07:00:00.000Z",
      invitation_last_sent_at: null,
      invitation_send_count: 0,
      linked_athletes: [],
      linked_trainer_id: "13000000-0000-0000-0000-00000000e2f1",
      linked_trainer_name: "Thomas Testtrainer",
      permissions: [{ module_key: "kindertraining", can_view: true, can_edit: true }],
    },
    {
      membership_id: "11000000-0000-0000-0000-00000000e2e2",
      user_id: "00000000-0000-0000-0000-00000000e2e2",
      email: "offen@example.test",
      display_name: "Offene Einladung",
      role: "trainer",
      status: "invited",
      email_confirmed_at: null,
      last_sign_in_at: null,
      created_at: "2026-08-02T07:00:00.000Z",
      updated_at: "2026-08-02T07:00:00.000Z",
      invitation_last_sent_at: "2026-08-02T07:00:00.000Z",
      invitation_send_count: 1,
      linked_athletes: [],
      linked_trainer_id: null,
      linked_trainer_name: null,
      permissions: [{ module_key: "kindertraining", can_view: true, can_edit: true }],
    },
  ]],
  ["admin_member_link_options", { athletes: [], trainers: [] }],
  ["admin_member_audit_overview", []],
  ["dropdown_settings_overview", {
    category: [{ id: null, key: "sprint", label: "Sprint", unit: "", input_type: "text", step_value: null, sort_order: 10, is_active: true, usage_count: 1 }],
    subcategory: [{ id: null, key: "beschleunigung", label: "Beschleunigung", unit: "", input_type: "text", step_value: null, sort_order: 10, is_active: true, usage_count: 1 }],
    material: [{ id: null, key: "markierungshuetchchen", label: "Markierungshütchen", unit: "", input_type: "text", step_value: null, sort_order: 10, is_active: true, usage_count: 1 }],
    difficulty: [{ id: "10000000-0000-4000-8000-000000000008", key: "medium", label: "Mittel", unit: "", input_type: "text", step_value: null, sort_order: 30, is_active: true, usage_count: 1 }],
    planning_parameter: catalogParameterOptions.map((item) => ({ ...item, id: null, usage_count: 1 })),
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
        invitation_last_sent_at: null,
        invitation_send_count: 0,
        created_at: "2026-08-01T08:00:00.000Z",
        updated_at: "2026-08-02T08:00:00.000Z",
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

  // The read-only suite uses an intentionally fake Supabase host. Intercept
  // Realtime WebSockets so Chromium does not perform a real DNS lookup.
  await page.routeWebSocket("wss://e2e.supabase.co/**", () => {});

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

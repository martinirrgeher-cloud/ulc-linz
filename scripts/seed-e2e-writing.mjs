import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.API_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const outputPath = resolve(process.env.E2E_SEED_OUTPUT || "test-results/e2e-writing/seed.json");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL/API_URL and SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY are required.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PASSWORD = "E1b2-Tests-2026!";
const ORGANIZATION_ID = "e1b20000-0000-0000-0000-000000000001";
const GROUP_ID = "e1b20000-0000-0000-0000-000000000010";
const ATHLETE_ID = "e1b20000-0000-0000-0000-000000000020";
const SECOND_ATHLETE_ID = "e1b20000-0000-0000-0000-000000000021";
const TRAINER_ID = "e1b20000-0000-0000-0000-000000000030";
const EXERCISE_ID = "e1b20000-0000-0000-0000-000000000040";
const BLOCK_ID = "e1b20000-0000-0000-0000-000000000050";

const USERS = {
  admin: { email: "admin.e1b2@example.test", displayName: "E2E Administrator" },
  trainer: { email: "trainer.e1b2@example.test", displayName: "E2E Trainer" },
  athlete: { email: "athlete.e1b2@example.test", displayName: "E2E Athlet" },
  parent: { email: "parent.e1b2@example.test", displayName: "E2E Elternteil" },
};

function assertResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function removeExistingUsers() {
  const listed = assertResult(
    await client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    "Existing test users could not be listed",
  );
  const testEmails = new Set(Object.values(USERS).map((user) => user.email));
  for (const user of listed.users) {
    if (!user.email || !testEmails.has(user.email)) continue;
    assertResult(
      await client.auth.admin.deleteUser(user.id),
      `Existing test user ${user.email} could not be deleted`,
    );
  }
}

async function createUser({ email, displayName }) {
  const data = assertResult(
    await client.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
    `Test user ${email} could not be created`,
  );
  if (!data.user) throw new Error(`Test user ${email} was created without a user object.`);
  return data.user;
}

async function seed() {
  assertResult(
    await client.from("organizations").delete().eq("id", ORGANIZATION_ID),
    "Existing E2E organization could not be removed",
  );
  await removeExistingUsers();

  const [admin, trainer, athlete, parent] = await Promise.all([
    createUser(USERS.admin),
    createUser(USERS.trainer),
    createUser(USERS.athlete),
    createUser(USERS.parent),
  ]);

  assertResult(
    await client.from("organizations").insert({
      id: ORGANIZATION_ID,
      name: "ULC Linz E2E Testverein",
      slug: "ulc-linz-e2e-testverein",
      is_active: true,
    }),
    "E2E organization could not be created",
  );

  const memberships = [
    {
      id: "e1b20000-0000-0000-0000-000000000101",
      organization_id: ORGANIZATION_ID,
      user_id: admin.id,
      role: "admin",
      status: "active",
    },
    {
      id: "e1b20000-0000-0000-0000-000000000102",
      organization_id: ORGANIZATION_ID,
      user_id: trainer.id,
      role: "trainer",
      status: "active",
    },
    {
      id: "e1b20000-0000-0000-0000-000000000103",
      organization_id: ORGANIZATION_ID,
      user_id: athlete.id,
      role: "athlete",
      status: "active",
    },
    {
      id: "e1b20000-0000-0000-0000-000000000104",
      organization_id: ORGANIZATION_ID,
      user_id: parent.id,
      role: "parent",
      status: "active",
    },
  ];
  assertResult(
    await client.from("organization_members").insert(memberships),
    "E2E memberships could not be created",
  );

  const trainerModules = [
    "athletes",
    "exercise_catalog",
    "training_blocks",
    "training_planning",
    "training_overview",
    "training_documentation",
    "performance_registration",
    "kindertraining",
    "u12",
    "u14",
  ];
  const athleteModules = ["performance_registration", "training_documentation", "training_overview"];
  const parentModules = ["kindertraining"];
  const permissions = [
    ...trainerModules.map((moduleKey) => ({
      membership_id: memberships[1].id,
      module_key: moduleKey,
      can_view: true,
      can_edit: true,
    })),
    ...athleteModules.map((moduleKey) => ({
      membership_id: memberships[2].id,
      module_key: moduleKey,
      can_view: true,
      can_edit: true,
    })),
    ...parentModules.map((moduleKey) => ({
      membership_id: memberships[3].id,
      module_key: moduleKey,
      can_view: true,
      can_edit: false,
    })),
  ];
  assertResult(
    await client.from("member_module_permissions").insert(permissions),
    "E2E module permissions could not be created",
  );

  assertResult(
    await client.from("training_groups").insert({
      id: GROUP_ID,
      organization_id: ORGANIZATION_ID,
      name: "E2E Leistungsgruppe",
      short_name: "E2E",
      description: "Isolierte Gruppe fuer schreibende Browsertests",
      is_active: true,
      sort_order: 10,
      module_key: null,
      regular_weekdays: [1, 2, 3, 4, 5, 6, 7],
      allow_special_training: true,
      created_by: admin.id,
    }),
    "E2E training group could not be created",
  );

  assertResult(
    await client.from("performance_group_settings").insert({
      organization_id: ORGANIZATION_ID,
      group_id: GROUP_ID,
      registration_deadline_weekday: 7,
      registration_deadline_time: "23:59",
      weeks_ahead: 4,
      allow_late_registration: true,
      created_by: admin.id,
    }),
    "E2E performance group settings could not be created",
  );

  assertResult(
    await client.from("athletes").insert([
      {
        id: ATHLETE_ID,
        organization_id: ORGANIZATION_ID,
        first_name: "Anna",
        last_name: "E2E",
        birth_year: 2010,
        notes: "E2E Ausgangsathletin",
        is_active: true,
        linked_user_id: athlete.id,
        created_by: admin.id,
      },
      {
        id: SECOND_ATHLETE_ID,
        organization_id: ORGANIZATION_ID,
        first_name: "Berta",
        last_name: "E2E",
        birth_year: 2012,
        notes: "Zweiter Athlet fuer Eltern-Mehrfachauswahl",
        is_active: true,
        linked_user_id: null,
        created_by: admin.id,
      },
    ]),
    "E2E athletes could not be created",
  );
  assertResult(
    await client.from("athlete_group_memberships").insert({
      organization_id: ORGANIZATION_ID,
      athlete_id: ATHLETE_ID,
      group_id: GROUP_ID,
      started_on: "2026-01-01",
      created_by: admin.id,
    }),
    "E2E athlete group assignment could not be created",
  );

  assertResult(
    await client.from("trainers").insert({
      id: TRAINER_ID,
      organization_id: ORGANIZATION_ID,
      first_name: "Tom",
      last_name: "E2E",
      email: USERS.trainer.email,
      is_active: true,
      linked_user_id: trainer.id,
      created_by: admin.id,
    }),
    "E2E trainer could not be created",
  );
  assertResult(
    await client.from("trainer_group_assignments").insert({
      organization_id: ORGANIZATION_ID,
      trainer_id: TRAINER_ID,
      group_id: GROUP_ID,
      created_by: admin.id,
    }),
    "E2E trainer group assignment could not be created",
  );

  const categories = assertResult(
    await client.from("exercise_categories").select("key,title,sort_order,is_active"),
    "Exercise categories could not be read",
  );
  assertResult(
    await client.from("organization_exercise_categories").insert(
      categories.map((category) => ({
        organization_id: ORGANIZATION_ID,
        category_key: category.key,
        title: category.title,
        sort_order: category.sort_order,
        is_active: category.is_active,
      })),
    ),
    "Organization exercise categories could not be created",
  );

  assertResult(
    await client.from("organization_dropdown_options").insert([
      {
        organization_id: ORGANIZATION_ID,
        list_key: "subcategory",
        option_key: "sprinttechnik",
        label: "Sprinttechnik",
        unit: "",
        input_type: "text",
        step_value: null,
        sort_order: 10,
        is_active: true,
      },
      {
        organization_id: ORGANIZATION_ID,
        list_key: "material",
        option_key: "markierungshuetchchen",
        label: "Markierungshuetchen",
        unit: "",
        input_type: "text",
        step_value: null,
        sort_order: 10,
        is_active: true,
      },
    ]),
    "E2E dropdown options could not be created",
  );

  const requiredPlanningParameterKeys = ["sets", "repetitions", "distance_m"];
  const seededPlanningParameters = assertResult(
    await client
      .from("organization_dropdown_options")
      .select("option_key")
      .eq("organization_id", ORGANIZATION_ID)
      .eq("list_key", "planning_parameter")
      .in("option_key", requiredPlanningParameterKeys),
    "Seeded E2E planning parameters could not be read",
  );
  const seededPlanningParameterKeys = new Set(seededPlanningParameters.map((option) => option.option_key));
  const missingPlanningParameterKeys = requiredPlanningParameterKeys.filter(
    (optionKey) => !seededPlanningParameterKeys.has(optionKey),
  );
  if (missingPlanningParameterKeys.length > 0) {
    throw new Error(
      `E2E planning parameters were not seeded for the organization: ${missingPlanningParameterKeys.join(", ")}`,
    );
  }

  assertResult(
    await client.from("exercises").insert({
      id: EXERCISE_ID,
      organization_id: ORGANIZATION_ID,
      name: "E2E Beschleunigungslauf",
      category_key: "acceleration",
      subcategory: "Sprinttechnik",
      goal: "Saubere Beschleunigung",
      description: "Aus dem Hochstart kontrolliert beschleunigen.",
      equipment: ["Markierungshuetchen"],
      is_active: true,
      created_by: admin.id,
    }),
    "E2E exercise could not be created",
  );
  assertResult(
    await client.from("exercise_parameter_definitions").insert({
      organization_id: ORGANIZATION_ID,
      exercise_id: EXERCISE_ID,
      parameter_key: "repetitions",
      label: "Wiederholungen",
      unit: "",
      input_type: "number",
      default_value: "4",
      min_value: 1,
      max_value: 20,
      step_value: 1,
      is_required: true,
      sort_order: 10,
    }),
    "E2E exercise parameter could not be created",
  );
  assertResult(
    await client.from("exercise_group_assignments").insert({
      organization_id: ORGANIZATION_ID,
      exercise_id: EXERCISE_ID,
      group_id: GROUP_ID,
    }),
    "E2E exercise group assignment could not be created",
  );

  assertResult(
    await client.from("training_blocks").insert({
      id: BLOCK_ID,
      organization_id: ORGANIZATION_ID,
      name: "E2E Beschleunigungsblock",
      goal: "Beschleunigung technisch sauber entwickeln",
      description: "Isolierter Ausgangsblock fuer E2E-Tests",
      estimated_minutes: 20,
      is_active: true,
      created_by: admin.id,
    }),
    "E2E training block could not be created",
  );
  assertResult(
    await client.from("training_block_group_assignments").insert({
      organization_id: ORGANIZATION_ID,
      block_id: BLOCK_ID,
      group_id: GROUP_ID,
    }),
    "E2E training block group assignment could not be created",
  );
  assertResult(
    await client.from("training_block_items").insert({
      organization_id: ORGANIZATION_ID,
      block_id: BLOCK_ID,
      exercise_id: EXERCISE_ID,
      sort_order: 1,
      note: "Volle Pause einhalten",
      parameter_values: { repetitions: "4" },
    }),
    "E2E training block item could not be created",
  );

  const output = {
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    athleteId: ATHLETE_ID,
    secondAthleteId: SECOND_ATHLETE_ID,
    trainerId: TRAINER_ID,
    exerciseId: EXERCISE_ID,
    blockId: BLOCK_ID,
    password: PASSWORD,
    users: Object.fromEntries(
      Object.entries(USERS).map(([role, value]) => [role, { email: value.email, displayName: value.displayName }]),
    ),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`E1b.2 seed written to ${outputPath}`);
}

await seed();

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.API_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const seedPath = resolve(process.env.E2E_SEED_OUTPUT || "test-results/e2e-writing/seed.json");

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL/API_URL, VITE_SUPABASE_PUBLISHABLE_KEY/ANON_KEY and SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY are required.",
  );
}

const seed = JSON.parse(await readFile(seedPath, "utf8"));
const admin = seed.users?.admin;
if (!seed.organizationId || !admin?.email || !seed.password) {
  throw new Error("The E2E seed output is incomplete for the authenticated Realtime probe.");
}

const reader = createClient(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const writer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timeoutId));
}

const probeId = randomUUID();
const channelName = `e2e-authenticated-realtime-${probeId}`;
let channel;
let probeInserted = false;

try {
  const { data: signInData, error: signInError } = await reader.auth.signInWithPassword({
    email: admin.email,
    password: seed.password,
  });
  if (signInError) throw signInError;
  if (!signInData.session) throw new Error("The Realtime probe login returned no session.");

  await reader.realtime.setAuth(signInData.session.access_token);

  let resolveEvent;
  let rejectEvent;
  const eventReceived = new Promise((resolve, reject) => {
    resolveEvent = resolve;
    rejectEvent = reject;
  });

  let resolveSubscribed;
  let rejectSubscribed;
  const subscribed = new Promise((resolve, reject) => {
    resolveSubscribed = resolve;
    rejectSubscribed = reject;
  });

  channel = reader
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "athletes",
        filter: `organization_id=eq.${seed.organizationId}`,
      },
      (payload) => {
        if (payload.new?.id === probeId) resolveEvent(payload);
      },
    )
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        resolveSubscribed();
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        rejectSubscribed(error || new Error(`Realtime channel ended with status ${status}.`));
        rejectEvent(error || new Error(`Realtime channel ended with status ${status}.`));
      }
    });

  await withTimeout(
    subscribed,
    10_000,
    "The authenticated Realtime channel did not reach SUBSCRIBED within 10 seconds.",
  );
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { error: insertError } = await writer.from("athletes").insert({
    id: probeId,
    organization_id: seed.organizationId,
    first_name: "Realtime",
    last_name: "Probe",
    birth_year: 2000,
    notes: "Temporary authenticated Realtime CI probe",
    is_active: true,
    created_by: signInData.session.user.id,
  });
  if (insertError) throw insertError;
  probeInserted = true;

  await withTimeout(
    eventReceived,
    10_000,
    "The authenticated Realtime channel was subscribed but received no RLS-authorized athlete event within 10 seconds.",
  );

  console.log("Authenticated Supabase Realtime probe passed.");
} finally {
  if (probeInserted) {
    const { error } = await writer.from("athletes").delete().eq("id", probeId);
    if (error) console.error(`Realtime probe cleanup failed: ${error.message}`);
  }
  if (channel) await reader.removeChannel(channel);
}

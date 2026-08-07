import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  assertSimulationWriteAllowed,
  isSimulationWriteGuardActive,
} from "@/features/simulation/simulation-guard";
import type { Database } from "@/types/database.generated";

const READ_ONLY_RPC_NAMES = new Set([
  "is_app_initialized",
  "admin_member_overview_v3",
  "admin_member_link_options",
  "admin_member_audit_overview",
  "athlete_overview",
  "training_group_overview_v3",
  "trainer_overview_v2",
  "organization_linkable_users",
  "dropdown_settings_overview",
  "exercise_catalog_overview_v4",
  "exercise_duplicate_candidates",
  "exercise_usage_overview",
  "exercise_video_overview",
  "performance_group_week_overview",
  "performance_registration_context",
  "training_module_statistics_overview",
  "kindertraining_statistics_overview",
  "training_module_configuration_overview",
  "training_module_group_trainer_ids",
  "training_module_session_overview",
  "kindertraining_configuration_overview",
  "kindertraining_group_trainer_ids",
  "kindertraining_session_overview",
  "training_block_exercise_video_overview",
  "training_block_overview_v4",
  "training_block_versions_overview",
  "training_documentation_detail",
  "training_documentation_overview",
  "training_documentation_statistics",
  "training_plan_week_overview",
  "training_plan_detail",
  "training_planning_overview",
]);

const WRITE_BUILDER_METHODS = new Set(["insert", "update", "delete", "upsert"]);
const WRITE_STORAGE_METHODS = new Set(["upload", "update", "remove", "move", "copy"]);
const WRITE_AUTH_METHODS = new Set(["signUp", "resetPasswordForEmail", "updateUser"]);

function bindOrValue(target: object, property: PropertyKey, receiver: unknown): unknown {
  const value = Reflect.get(target, property, receiver);
  return typeof value === "function" ? value.bind(target) : value;
}

function wrapBuilder<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (typeof property === "string" && WRITE_BUILDER_METHODS.has(property)) {
        return (...args: unknown[]) => {
          assertSimulationWriteAllowed("Die Datenänderung");
          const method = Reflect.get(target, property, target) as (...callArgs: unknown[]) => unknown;
          return method.apply(target, args);
        };
      }
      return bindOrValue(target, property, receiver);
    },
  });
}

function wrapStorageBucket<T extends object>(bucket: T): T {
  return new Proxy(bucket, {
    get(target, property, receiver) {
      if (typeof property === "string" && WRITE_STORAGE_METHODS.has(property)) {
        return (...args: unknown[]) => {
          assertSimulationWriteAllowed("Der Datei- oder Medienzugriff");
          const method = Reflect.get(target, property, target) as (...callArgs: unknown[]) => unknown;
          return method.apply(target, args);
        };
      }
      return bindOrValue(target, property, receiver);
    },
  });
}

function createSimulationSafeClient(client: SupabaseClient<Database>): SupabaseClient<Database> {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "rpc") {
        return (functionName: string, ...args: unknown[]) => {
          if (isSimulationWriteGuardActive() && !READ_ONLY_RPC_NAMES.has(functionName)) {
            assertSimulationWriteAllowed(`Die Aktion „${functionName}“`);
          }
          return (target.rpc as (...callArgs: unknown[]) => unknown).call(target, functionName, ...args);
        };
      }

      if (property === "from") {
        return (...args: unknown[]) => {
          const builder = (target.from as (...callArgs: unknown[]) => object).apply(target, args);
          return wrapBuilder(builder);
        };
      }

      if (property === "functions") {
        const functions = target.functions;
        return new Proxy(functions, {
          get(functionTarget, functionProperty, functionReceiver) {
            if (functionProperty === "invoke") {
              return (...args: unknown[]) => {
                assertSimulationWriteAllowed("Die Serveraktion");
                return (functionTarget.invoke as (...callArgs: unknown[]) => unknown).apply(functionTarget, args);
              };
            }
            return bindOrValue(functionTarget, functionProperty, functionReceiver);
          },
        });
      }

      if (property === "storage") {
        const storage = target.storage;
        return new Proxy(storage, {
          get(storageTarget, storageProperty, storageReceiver) {
            if (storageProperty === "from") {
              return (...args: unknown[]) => {
                const bucket = (storageTarget.from as (...callArgs: unknown[]) => object).apply(storageTarget, args);
                return wrapStorageBucket(bucket);
              };
            }
            return bindOrValue(storageTarget, storageProperty, storageReceiver);
          },
        });
      }

      if (property === "auth") {
        const auth = target.auth;
        return new Proxy(auth, {
          get(authTarget, authProperty, authReceiver) {
            if (typeof authProperty === "string" && WRITE_AUTH_METHODS.has(authProperty)) {
              return (...args: unknown[]) => {
                assertSimulationWriteAllowed("Die Kontoänderung");
                const method = Reflect.get(authTarget, authProperty, authTarget) as (...callArgs: unknown[]) => unknown;
                return method.apply(authTarget, args);
              };
            }
            return bindOrValue(authTarget, authProperty, authReceiver);
          },
        });
      }

      return bindOrValue(target, property, receiver);
    },
  }) as SupabaseClient<Database>;
}

const rawSupabase: SupabaseClient<Database> | null = env.isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase: SupabaseClient<Database> | null = rawSupabase
  ? createSimulationSafeClient(rawSupabase)
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY setzen.",
    );
  }

  return supabase;
}

-- Reserved for local, non-production test data.
-- The local E2E seed client uses the Supabase service_role key.
-- RLS bypass alone is not sufficient when explicit table privileges are missing.
-- This file is executed by local `supabase db reset` only and is not a production migration.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

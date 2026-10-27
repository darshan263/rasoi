-- Run this in the Supabase SQL editor AFTER `prisma db push` has created the tables.
-- Adding a model? Add its "enable row level security" line below first, then re-run this.
--
-- Supabase publishes everything in the `public` schema through PostgREST, reachable with the
-- project's public `anon` key. Rasoi never uses PostgREST, Supabase Auth or the anon key: it
-- talks to Postgres directly through Prisma, as the table owner. Row level security with no
-- policies denies every other role, so the app is unaffected and the REST API gets nothing
-- (no password hash, no recipes, no photos).

alter table public."User" enable row level security;
alter table public."RateLimit" enable row level security;
alter table public."Image" enable row level security;
alter table public."Ingredient" enable row level security;
alter table public."Recipe" enable row level security;
alter table public."RecipeSection" enable row level security;
alter table public."SectionItem" enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

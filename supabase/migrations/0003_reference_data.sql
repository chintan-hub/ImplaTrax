-- ============================================================================
-- ImplaTrax — Supabase migration 0003: global reference data
-- ============================================================================
-- Manufacturers are a real-world catalog of implant brands — identical
-- across every clinic/workspace, not per-tenant data (this mirrors the
-- original app's own comment on MANUFACTURERS in src/types/index.ts: "a
-- fixed, real-world catalog... not per-clinic data"). Modeled as a single
-- global, world-readable table rather than duplicated per workspace.
-- product_category stays a plain enum (migration 0001) since, unlike
-- manufacturers, the app was never asked to let workspaces manage their own
-- category list.

create table manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

comment on table manufacturers is 'Global reference catalog of implant brands, shared by every workspace — not tenant data, so it carries no workspace_id and no RLS write restriction beyond authenticated-read.';

insert into manufacturers (name) values
  ('Straumann'), ('Nobel Biocare'), ('Osstem'), ('NeoBiotech'), ('Dentium'), ('MIS')
on conflict (name) do nothing;

alter table manufacturers enable row level security;

create policy "manufacturers_read_all_authenticated" on manufacturers
  for select to authenticated
  using (true);

-- No insert/update/delete policy is created deliberately: manufacturers is
-- reference data curated by the platform, not user-writable from the app.
-- If a future requirement needs workspaces to add custom manufacturers,
-- add a `workspace_id uuid references workspaces(id)` nullable column
-- (null = global) and a scoped insert policy — do not relax this table's
-- existing rows to be writable.

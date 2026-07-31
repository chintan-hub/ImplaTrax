-- ============================================================================
-- ImplaTrax — Supabase migration 0002: workspaces, membership, invitations
-- ============================================================================
-- Multi-tenancy root. Every business table in later migrations carries a
-- workspace_id column that FKs to workspaces(id) and is enforced by RLS.
--
-- Note on PIN/biometrics: the local device-unlock PIN (and WebAuthn
-- passkey id) from the pre-Supabase build stays 100% client-side, in this
-- browser's localStorage — it is a *device* convenience layered on top of
-- a real Supabase Auth session, not a cross-device credential, so it is
-- deliberately NOT modeled here. Supabase Auth (email + password) is what
-- makes a workspace reachable from a new device; the PIN is what makes
-- returning to an *already-signed-in* device fast.

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Guards the one-time localStorage -> Supabase import against re-running.
  local_migration_completed_at timestamptz
);

comment on table workspaces is 'Tenant root. Every business table FKs to this and is RLS-scoped by it.';

-- ----------------------------------------------------------------------------
-- workspace_members — replaces both the local account system's `members`
-- table AND the original `AppUser` business-permission table (see
-- account_role / business_role in migration 0001 for why both roles live
-- here as columns rather than as two separate 1:1 tables).
-- ----------------------------------------------------------------------------
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- Nullable: a member can exist before they've ever signed in (added
  -- directly by an admin, or invited) — auth_user_id is filled in the
  -- moment they accept an invitation / sign up with the matching email.
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  contact_email text,
  contact_phone text,
  avatar_color text not null default '#14b8a6',
  account_role account_role not null default 'staff',
  business_role business_role not null default 'front_desk',
  status member_status not null default 'active',
  last_login_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One auth user maps to at most one member row per workspace.
  unique (workspace_id, auth_user_id)
);

create index idx_workspace_members_workspace on workspace_members (workspace_id);
create index idx_workspace_members_auth_user on workspace_members (auth_user_id);

comment on table workspace_members is 'A person''s membership + role(s) in one workspace. account_role gates workspace/security management; business_role gates day-to-day feature permissions.';

-- ----------------------------------------------------------------------------
-- workspace_invitations — now a REAL cross-device invite (the local-only
-- build shipped this as a disabled "requires Cloud Workspace" placeholder;
-- with a real backend it can finally work as originally intended).
-- ----------------------------------------------------------------------------
create table workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  account_role account_role not null default 'staff',
  business_role business_role not null default 'front_desk',
  invited_by uuid references workspace_members(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references workspace_members(id) on delete set null,
  accepted_at timestamptz,
  unique (workspace_id, email, status) deferrable initially deferred
);

create index idx_workspace_invitations_workspace on workspace_invitations (workspace_id);
create index idx_workspace_invitations_token on workspace_invitations (token);
create index idx_workspace_invitations_email on workspace_invitations (lower(email));

comment on table workspace_invitations is 'Pending/accepted/revoked invites. token is the value embedded in the invite link/code.';

-- ----------------------------------------------------------------------------
-- Helper functions used throughout RLS policies (migration 0010) and the
-- application. SECURITY DEFINER + a fixed search_path is required so these
-- are safe to call from RLS policies without being hijacked by a
-- search_path attack.
-- ----------------------------------------------------------------------------

-- All workspace ids the currently-authenticated user is an active member of.
create or replace function auth_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id
  from workspace_members
  where auth_user_id = auth.uid()
    and status = 'active'
$$;

-- The current user's member row + role within a specific workspace (null if not a member).
create or replace function auth_member_role(p_workspace_id uuid)
returns account_role
language sql
security definer
set search_path = public
stable
as $$
  select account_role
  from workspace_members
  where workspace_id = p_workspace_id
    and auth_user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function is_workspace_manager(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth_member_role(p_workspace_id) in ('owner', 'super_admin', 'admin')
$$;

-- Shared updated_at trigger, reused by every table below.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();
create trigger trg_workspace_members_updated_at before update on workspace_members
  for each row execute function set_updated_at();

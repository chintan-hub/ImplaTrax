-- ============================================================================
-- ImplaTrax — Supabase migration 0010: Row Level Security policies
-- ============================================================================
-- Scope of enforcement: this migration guarantees the one thing that must
-- never be violated — a workspace can never read or write another
-- workspace's data. It does NOT re-implement the app's fine-grained
-- business_role permission matrix (View pricing / Adjust stock / Manage
-- patients / etc. — see the Users page's Role Permissions table) at the
-- database layer; that matrix was always a UI-layer concern in the
-- original localStorage build (DataContext never hard-blocked an action by
-- business_role either), and stays one here. What IS enforced at this
-- layer, beyond workspace isolation, is workspace/team/security
-- management being restricted to account_role owner/super_admin/admin
-- (via is_workspace_manager()) — that boundary was already hard-enforced
-- in the original AuthContext and is security-relevant, not just UX.

-- All workspace_member ids belonging to the current authenticated user —
-- used by policies that check "is this MY member row" rather than "am I
-- A member of this workspace" (e.g. marking my own notification read).
create or replace function auth_member_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from workspace_members where auth_user_id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- workspaces
-- ----------------------------------------------------------------------------
alter table workspaces enable row level security;

create policy "workspaces_select_member" on workspaces
  for select to authenticated
  using (id in (select auth_workspace_ids()));

-- Row creation happens through the create_workspace() RPC (migration 0011),
-- which is SECURITY DEFINER and bypasses RLS — no direct client insert path.
create policy "workspaces_update_manager" on workspaces
  for update to authenticated
  using (is_workspace_manager(id))
  with check (is_workspace_manager(id));

-- ----------------------------------------------------------------------------
-- workspace_members
-- ----------------------------------------------------------------------------
alter table workspace_members enable row level security;

create policy "workspace_members_select_same_workspace" on workspace_members
  for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

create policy "workspace_members_insert_manager" on workspace_members
  for insert to authenticated
  with check (is_workspace_manager(workspace_id));

-- A manager can update anyone in the workspace; anyone can update their own row
-- (profile fields) — matches updateProfile in the original AuthContext.
create policy "workspace_members_update_manager_or_self" on workspace_members
  for update to authenticated
  using (is_workspace_manager(workspace_id) or auth_user_id = auth.uid())
  with check (is_workspace_manager(workspace_id) or auth_user_id = auth.uid());

create policy "workspace_members_delete_manager" on workspace_members
  for delete to authenticated
  using (is_workspace_manager(workspace_id));

-- ----------------------------------------------------------------------------
-- workspace_invitations — manager-only. Someone accepting an invite isn't a
-- member yet and can't be matched by auth_workspace_ids(), so acceptance is
-- handled by the accept_invitation() RPC (migration 0011, SECURITY DEFINER,
-- validated by the invite's unguessable token) rather than a broader SELECT
-- policy that would let any authenticated user browse other workspaces'
-- pending invitations.
-- ----------------------------------------------------------------------------
alter table workspace_invitations enable row level security;

create policy "workspace_invitations_all_manager" on workspace_invitations
  for all to authenticated
  using (is_workspace_manager(workspace_id))
  with check (is_workspace_manager(workspace_id));

-- ----------------------------------------------------------------------------
-- Generic workspace-scoped business data — every table below follows the
-- same shape: any active member of the workspace can read and write. Named
-- individually (not looped) because DDL can't be parameterized, but every
-- policy is intentionally identical in structure.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'vendors', 'products', 'product_batches', 'inventory_movements',
    'purchase_orders', 'purchase_order_lines', 'purchase_order_events',
    'doctors', 'patients', 'cases', 'case_implant_usages', 'case_events',
    'labs', 'loans', 'loan_lines', 'loan_events',
    'sales', 'sale_lines'
  ]
  loop
    execute format(
      'create policy "%1$s_select_member" on %1$s for select to authenticated using (workspace_id in (select auth_workspace_ids()));',
      t
    );
    execute format(
      'create policy "%1$s_insert_member" on %1$s for insert to authenticated with check (workspace_id in (select auth_workspace_ids()));',
      t
    );
    execute format(
      'create policy "%1$s_update_member" on %1$s for update to authenticated using (workspace_id in (select auth_workspace_ids())) with check (workspace_id in (select auth_workspace_ids()));',
      t
    );
    execute format(
      'create policy "%1$s_delete_member" on %1$s for delete to authenticated using (workspace_id in (select auth_workspace_ids()));',
      t
    );
  end loop;
end $$;

-- inventory_movements is append-only in the application (see comment on the
-- table in migration 0004) — revoke update/delete even though the loop
-- above granted them, so the database backs up that invariant rather than
-- relying on client code alone.
drop policy "inventory_movements_update_member" on inventory_movements;
drop policy "inventory_movements_delete_member" on inventory_movements;

-- purchase_order_events, case_events, loan_events are append-only audit
-- trails — same reasoning.
drop policy "purchase_order_events_update_member" on purchase_order_events;
drop policy "purchase_order_events_delete_member" on purchase_order_events;
drop policy "case_events_update_member" on case_events;
drop policy "case_events_delete_member" on case_events;
drop policy "loan_events_update_member" on loan_events;
drop policy "loan_events_delete_member" on loan_events;

-- vendor_manufacturers has no workspace_id of its own (it's a join table) —
-- scope it through its parent vendor instead.
alter table vendor_manufacturers enable row level security;

create policy "vendor_manufacturers_select_member" on vendor_manufacturers
  for select to authenticated
  using (vendor_id in (select id from vendors where workspace_id in (select auth_workspace_ids())));

create policy "vendor_manufacturers_write_member" on vendor_manufacturers
  for all to authenticated
  using (vendor_id in (select id from vendors where workspace_id in (select auth_workspace_ids())))
  with check (vendor_id in (select id from vendors where workspace_id in (select auth_workspace_ids())));

-- ----------------------------------------------------------------------------
-- clinic_settings / security_prefs — readable by any member, writable only
-- by a workspace manager (matches ClinicTab/SecurityTab being gated behind
-- WORKSPACE_MANAGER_ROLES in the original app). No insert/delete policy:
-- the single row per workspace is created once by create_workspace()
-- (SECURITY DEFINER, migration 0011), then updated in place by
-- complete_onboarding() and later edits.
-- ----------------------------------------------------------------------------
create policy "clinic_settings_select_member" on clinic_settings
  for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

create policy "clinic_settings_update_manager" on clinic_settings
  for update to authenticated
  using (is_workspace_manager(workspace_id))
  with check (is_workspace_manager(workspace_id));

create policy "security_prefs_select_member" on security_prefs
  for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

create policy "security_prefs_update_manager" on security_prefs
  for update to authenticated
  using (is_workspace_manager(workspace_id))
  with check (is_workspace_manager(workspace_id));

-- ----------------------------------------------------------------------------
-- audit_log — manager-only read (account/security history), no client
-- write path at all (every entry is written by an RPC as part of the
-- action it's logging, never inserted directly by the client).
-- ----------------------------------------------------------------------------
create policy "audit_log_select_manager" on audit_log
  for select to authenticated
  using (is_workspace_manager(workspace_id));

-- ----------------------------------------------------------------------------
-- notifications — a member sees their own notifications plus any
-- workspace-wide ones (member_id is null); they may only mark their own as
-- read. No client insert/delete — notifications are system/RPC-generated.
-- ----------------------------------------------------------------------------
create policy "notifications_select_own_or_broadcast" on notifications
  for select to authenticated
  using (workspace_id in (select auth_workspace_ids()) and (member_id is null or member_id in (select auth_member_ids())));

create policy "notifications_update_own" on notifications
  for update to authenticated
  using (member_id in (select auth_member_ids()))
  with check (member_id in (select auth_member_ids()));

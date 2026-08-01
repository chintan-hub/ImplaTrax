-- ============================================================================
-- ImplaTrax — Supabase migration 0009: clinic settings, security prefs,
-- audit log, notifications
-- ============================================================================
-- clinic_settings and security_prefs are both strictly 1:1 with a workspace
-- (ClinicSettings / SecurityPrefs in the original types) — modeled as
-- single-row-per-workspace tables rather than columns on `workspaces`
-- itself, so RLS on `workspaces` (workspace existence/membership) stays
-- separate from RLS on settings (which a non-manager can read but not
-- write — see migration 0010).

create table clinic_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  clinic_name text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  country text not null default '',
  logo_url text, -- Supabase Storage object path, replaces the local build's inline base64 data URI
  currency text not null default 'USD',
  price_visibility_default boolean not null default true,
  barcode_format barcode_format not null default 'CODE128',
  low_stock_global_default integer not null default 10,
  theme theme_preference not null default 'system',
  batch_lot_tracking_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger trg_clinic_settings_updated_at before update on clinic_settings for each row execute function set_updated_at();

create table security_prefs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  auto_lock_minutes integer not null default 5,
  session_timeout_minutes integer not null default 720,
  max_pin_attempts integer not null default 5,
  lockout_minutes integer not null default 1,
  desktop_notifications boolean not null default false
);

-- ----------------------------------------------------------------------------
-- audit_log — the workspace-level account/security trail (AuditEntry in
-- accountTypes.ts: logins, PIN changes, member management, workspace
-- changes). Distinct from the append-only *_events tables (case_events,
-- purchase_order_events, loan_events), which are per-record business
-- history, not account/security events.
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_member_id uuid references workspace_members(id) on delete set null,
  actor_name text not null,
  action audit_action not null,
  detail text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_workspace on audit_log (workspace_id, created_at desc);

comment on table audit_log is 'Append-only. Capped to the most recent 300 entries per workspace client-side in the original build — enforced here instead by a scheduled cleanup job (see README), not a hard row limit, since Postgres has no such native cap.';

-- ----------------------------------------------------------------------------
-- notifications — server-computed equivalents of the local build's
-- client-derived Topbar alerts (low stock count, pending PO count). Stored
-- so Realtime can push them and so "seen" state survives a refresh/device
-- change, neither of which the purely-derived local version needed.
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid references workspace_members(id) on delete cascade, -- null = visible to every member of the workspace
  type notification_type not null,
  title text not null,
  body text not null default '',
  link_path text, -- client-side route to navigate to on click, e.g. '/inventory'
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_workspace on notifications (workspace_id, created_at desc);
create index idx_notifications_member_unread on notifications (member_id, created_at desc) where read_at is null;

alter table clinic_settings enable row level security;
alter table security_prefs enable row level security;
alter table audit_log enable row level security;
alter table notifications enable row level security;

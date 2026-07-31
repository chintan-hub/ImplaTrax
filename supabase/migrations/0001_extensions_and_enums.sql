-- ============================================================================
-- ImplaTrax — Supabase migration 0001: extensions + enum types
-- ============================================================================
-- This is the foundation migration. Every later migration depends on the
-- extensions and enum types defined here. Run migrations in numeric order —
-- either via `supabase db push` / `supabase migration up` (recommended), or
-- by pasting each file's contents into the Supabase SQL Editor in order.

-- gen_random_uuid() for primary keys — every table in this schema uses a
-- client-and-server-generatable UUID primary key (not a serial/identity
-- column). This is deliberate: it lets the client optimistically create a
-- row's id before the network round-trip completes (the "optimistic update"
-- requirement) and lets the offline-write queue re-send the same id safely
-- without ever creating a duplicate row.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Workspace membership tier (the "account" role from the local PIN/account
-- system this migration replaces the localStorage backing of — see
-- src/features/auth/accountTypes.ts `AccountRole`). Governs who can manage
-- team members, invitations, and workspace security settings.
-- ----------------------------------------------------------------------------
create type account_role as enum ('owner', 'super_admin', 'admin', 'manager', 'staff', 'read_only');

-- ----------------------------------------------------------------------------
-- Business permission tier (src/types/index.ts `UserRole`) — a completely
-- different axis from account_role: it governs day-to-day feature
-- permissions (view pricing, manage patients, adjust stock, etc.), documented
-- in the Users page's Role Permissions matrix. Kept as a separate enum/column
-- on workspace_members rather than a second table, since it is always 1:1
-- with a member.
-- ----------------------------------------------------------------------------
create type business_role as enum ('admin', 'clinician', 'inventory_manager', 'front_desk');

create type member_status as enum ('active', 'disabled', 'invited');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create type product_category as enum (
  'implant_fixture', 'healing_abutment', 'final_abutment', 'cover_screw',
  'impression_coping', 'analog', 'surgical_kit', 'bone_graft_material',
  'membrane', 'prosthetic_screw'
);
create type product_status as enum ('active', 'discontinued');

create type movement_type as enum ('inbound', 'outbound', 'adjustment', 'loan_out', 'loan_return', 'sale', 'lost');

create type po_status as enum ('draft', 'submitted', 'confirmed', 'partially_received', 'received', 'cancelled');

create type patient_sex as enum ('male', 'female');

create type case_status as enum ('planning', 'surgery_scheduled', 'in_progress', 'restoration', 'completed', 'cancelled');

create type loan_status as enum ('open', 'partially_returned', 'closed');

create type barcode_format as enum ('CODE128', 'CODE39', 'EAN13');

create type theme_preference as enum ('light', 'dark', 'system');

create type audit_action as enum (
  'onboarding_completed', 'login', 'login_failed', 'account_locked_out', 'logout', 'lock',
  'auto_locked', 'session_timeout', 'pin_changed', 'pin_reset_by_admin',
  'biometrics_enabled', 'biometrics_disabled', 'member_added', 'member_invited',
  'member_disabled', 'member_reactivated', 'member_role_changed', 'member_removed',
  'workspace_created', 'workspace_renamed', 'profile_updated',
  'product_created', 'product_updated', 'stock_adjusted',
  'purchase_order_created', 'purchase_order_submitted', 'purchase_order_confirmed',
  'purchase_order_received', 'purchase_order_cancelled',
  'case_created', 'case_status_changed', 'sale_created', 'loan_created', 'loan_returned'
);

create type notification_type as enum ('low_stock', 'po_status', 'loan_status', 'sale_created', 'case_status', 'system');

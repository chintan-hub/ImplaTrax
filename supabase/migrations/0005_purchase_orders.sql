-- ============================================================================
-- ImplaTrax — Supabase migration 0005: purchase orders
-- ============================================================================

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  po_number text not null,
  vendor_id uuid not null references vendors(id) on delete restrict,
  status po_status not null default 'draft',
  eta date,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  received_at timestamptz,
  notes text,
  photo_url text, -- Supabase Storage object path (see storage bucket setup in README)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, po_number)
);

create index idx_purchase_orders_workspace on purchase_orders (workspace_id);
create index idx_purchase_orders_vendor on purchase_orders (vendor_id);
create index idx_purchase_orders_status on purchase_orders (workspace_id, status);
create trigger trg_purchase_orders_updated_at before update on purchase_orders for each row execute function set_updated_at();

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost numeric(12,2) not null default 0
);

create index idx_po_lines_workspace on purchase_order_lines (workspace_id);
create index idx_po_lines_po on purchase_order_lines (po_id);
create index idx_po_lines_product on purchase_order_lines (product_id);

create table purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  po_id uuid not null references purchase_orders(id) on delete cascade,
  label text not null,
  description text not null default '',
  actor text not null,
  event_date timestamptz not null default now()
);

create index idx_po_events_po on purchase_order_events (po_id, event_date);

comment on table purchase_order_events is 'Append-only audit trail — every PO status transition adds a row here, never edited or removed (mirrors PurchaseOrder.history in the original type).';

alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;
alter table purchase_order_events enable row level security;

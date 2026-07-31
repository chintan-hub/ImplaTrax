-- ============================================================================
-- ImplaTrax — Supabase migration 0004: vendors, products, batches, inventory
-- ============================================================================
-- Vendors is created here (rather than alongside purchase orders in 0005)
-- because products.vendor_id needs to reference it.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  country text not null default '',
  on_time_rate numeric(4,3) not null default 0 check (on_time_rate >= 0 and on_time_rate <= 1),
  total_orders integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vendors_workspace on vendors (workspace_id);
create trigger trg_vendors_updated_at before update on vendors for each row execute function set_updated_at();

-- Vendor.manufacturers (Manufacturer[]) from the original type — a proper
-- many-to-many join table instead of an array column.
create table vendor_manufacturers (
  vendor_id uuid not null references vendors(id) on delete cascade,
  manufacturer_id uuid not null references manufacturers(id) on delete restrict,
  primary key (vendor_id, manufacturer_id)
);

create index idx_vendor_manufacturers_manufacturer on vendor_manufacturers (manufacturer_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sku text not null,
  name text not null,
  manufacturer_id uuid not null references manufacturers(id),
  category product_category not null,
  system text not null,
  diameter_mm numeric(6,2),
  length_mm numeric(6,2),
  platform text,
  barcode text not null,
  qr_payload text not null,
  unit_cost numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  price_visible boolean not null default true,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  low_stock_threshold integer not null default 5,
  batch_tracked boolean not null default false,
  vendor_id uuid not null references vendors(id),
  image_color text not null default '#14b8a6',
  description text not null default '',
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku),
  unique (workspace_id, barcode)
);

create index idx_products_workspace on products (workspace_id);
create index idx_products_vendor on products (vendor_id);
create index idx_products_manufacturer on products (manufacturer_id);
create index idx_products_status on products (workspace_id, status);
create index idx_products_low_stock on products (workspace_id) where quantity_on_hand <= low_stock_threshold;
create trigger trg_products_updated_at before update on products for each row execute function set_updated_at();

comment on table products is 'The item catalog. quantity_on_hand is a denormalized cache of the sum of inventory_movements, kept in sync only by the RPC functions in migration 0011 (adjust_stock, receive_purchase_order, etc.) — never written directly by client code.';

create table product_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lot_number text not null,
  expiry_date date,
  quantity integer not null default 0 check (quantity >= 0),
  received_at timestamptz not null default now(),
  reference text,
  unique (product_id, lot_number)
);

create index idx_product_batches_workspace on product_batches (workspace_id);
create index idx_product_batches_product on product_batches (product_id);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  type movement_type not null,
  quantity integer not null, -- signed: positive = increase, negative = decrease
  quantity_before integer not null,
  quantity_after integer not null,
  reason text not null,
  reference text,
  performed_by uuid references workspace_members(id) on delete set null,
  note text,
  batch_lot text,
  vendor_id uuid references vendors(id) on delete set null,
  lab_id uuid,     -- FK constraint added in 0007 (added_at bottom of that file) once labs exists
  patient_id uuid, -- FK constraint added in 0006 once patients exists
  doctor text,
  case_id uuid,    -- FK constraint added in 0006 once cases exists
  created_at timestamptz not null default now()
);

create index idx_inventory_movements_workspace on inventory_movements (workspace_id);
create index idx_inventory_movements_product on inventory_movements (product_id, created_at desc);
create index idx_inventory_movements_created_at on inventory_movements (workspace_id, created_at desc);

comment on table inventory_movements is 'Append-only ledger — every row is a full snapshot of the stock change at write time (quantity_before/after), matching the original localStorage design''s invariant. Never updated or deleted.';

alter table vendors enable row level security;
alter table vendor_manufacturers enable row level security;
alter table products enable row level security;
alter table product_batches enable row level security;
alter table inventory_movements enable row level security;

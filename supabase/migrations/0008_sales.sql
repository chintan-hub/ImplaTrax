-- ============================================================================
-- ImplaTrax — Supabase migration 0008: sales
-- ============================================================================

create table sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sale_number text not null,
  patient_id uuid references patients(id) on delete set null,
  case_id uuid references cases(id) on delete set null,
  total numeric(12,2) not null default 0,
  sold_by uuid references workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, sale_number)
);

create index idx_sales_workspace on sales (workspace_id);
create index idx_sales_patient on sales (patient_id) where patient_id is not null;
create index idx_sales_case on sales (case_id) where case_id is not null;
create index idx_sales_created_at on sales (workspace_id, created_at desc);

comment on table sales is 'A sale means a component was permanently used or sold. total is a denormalized cache of sum(sale_lines.quantity * sale_lines.unit_price), written once at creation — sales are never edited after the fact, matching the original type''s immutability.';

create table sale_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  batch_lot text
);

create index idx_sale_lines_workspace on sale_lines (workspace_id);
create index idx_sale_lines_sale on sale_lines (sale_id);
create index idx_sale_lines_product on sale_lines (product_id);

alter table sales enable row level security;
alter table sale_lines enable row level security;

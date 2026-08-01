-- ============================================================================
-- ImplaTrax — Supabase migration 0007: labs, loans
-- ============================================================================

create table labs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  specialties text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  turnaround_days integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_labs_workspace on labs (workspace_id);

create table loans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  loan_number text not null,
  lab_id uuid not null references labs(id) on delete restrict,
  status loan_status not null default 'open',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, loan_number)
);

create index idx_loans_workspace on loans (workspace_id);
create index idx_loans_lab on loans (lab_id);
create index idx_loans_status on loans (workspace_id, status);
create trigger trg_loans_updated_at before update on loans for each row execute function set_updated_at();

create table loan_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity_loaned integer not null check (quantity_loaned > 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  quantity_lost integer not null default 0 check (quantity_lost >= 0),
  lost_reason text,
  batch_lot text,
  check (quantity_returned + quantity_lost <= quantity_loaned)
);

create index idx_loan_lines_workspace on loan_lines (workspace_id);
create index idx_loan_lines_loan on loan_lines (loan_id);
create index idx_loan_lines_product on loan_lines (product_id);

create table loan_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  label text not null,
  description text not null default '',
  actor text not null,
  event_date timestamptz not null default now()
);

create index idx_loan_events_loan on loan_events (loan_id, event_date);

comment on table loan_events is 'Append-only audit trail mirroring Loan.history in the original type.';

-- Now that labs exists, complete the deferred FKs from earlier migrations.
alter table cases add constraint fk_cases_lab foreign key (lab_id) references labs(id) on delete set null;
create index idx_cases_lab on cases (lab_id) where lab_id is not null;

alter table inventory_movements add constraint fk_inventory_movements_lab foreign key (lab_id) references labs(id) on delete set null;
create index idx_inventory_movements_lab on inventory_movements (lab_id) where lab_id is not null;

alter table labs enable row level security;
alter table loans enable row level security;
alter table loan_lines enable row level security;
alter table loan_events enable row level security;

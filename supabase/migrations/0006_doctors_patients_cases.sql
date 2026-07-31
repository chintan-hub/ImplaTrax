-- ============================================================================
-- ImplaTrax — Supabase migration 0006: doctors, patients, cases
-- ============================================================================

create table doctors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, -- excludes the "Dr." prefix, same convention as the original type
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index idx_doctors_workspace on doctors (workspace_id);

create table patients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  patient_code text not null, -- e.g. PT-00123
  first_name text not null,
  last_name text not null,
  dob date not null,
  sex patient_sex not null,
  phone text not null default '',
  email text not null default '',
  primary_doctor text not null default '', -- free-text display name, matches Case.doctor's convention (not a Doctor.id FK)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, patient_code)
);

create index idx_patients_workspace on patients (workspace_id);
create index idx_patients_name on patients (workspace_id, last_name, first_name);
create trigger trg_patients_updated_at before update on patients for each row execute function set_updated_at();

create table cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_number text not null, -- human readable: IDC-2026-00001
  patient_id uuid not null references patients(id) on delete restrict,
  doctor text not null,
  lab_id uuid, -- FK constraint added at the bottom of 0007 once labs exists
  status case_status not null default 'planning',
  procedure_description text not null default '',
  scheduled_date date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, case_number)
);

create index idx_cases_workspace on cases (workspace_id);
create index idx_cases_patient on cases (patient_id);
create index idx_cases_status on cases (workspace_id, status);
create trigger trg_cases_updated_at before update on cases for each row execute function set_updated_at();

create table case_implant_usages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  tooth text not null, -- FDI tooth number, e.g. "36"
  quantity integer not null check (quantity > 0),
  batch_lot text
);

create index idx_case_implant_usages_case on case_implant_usages (case_id);
create index idx_case_implant_usages_product on case_implant_usages (product_id);

create table case_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  label text not null,
  description text not null default '',
  actor text not null,
  event_date timestamptz not null default now()
);

create index idx_case_events_case on case_events (case_id, event_date);

comment on table case_events is 'Append-only audit trail mirroring Case.history in the original type.';

-- Now that patients and cases exist, complete the deferred FKs on inventory_movements (0004).
alter table inventory_movements
  add constraint fk_inventory_movements_patient foreign key (patient_id) references patients(id) on delete set null,
  add constraint fk_inventory_movements_case foreign key (case_id) references cases(id) on delete set null;

create index idx_inventory_movements_patient on inventory_movements (patient_id) where patient_id is not null;
create index idx_inventory_movements_case on inventory_movements (case_id) where case_id is not null;

alter table doctors enable row level security;
alter table patients enable row level security;
alter table cases enable row level security;
alter table case_implant_usages enable row level security;
alter table case_events enable row level security;

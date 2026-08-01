-- ============================================================================
-- ImplaTrax — Supabase migration 0011: RPC functions
-- ============================================================================
-- Every function here is SECURITY DEFINER (so it can write to tables the
-- calling role has no direct INSERT/UPDATE grant on, e.g. products.
-- quantity_on_hand) and therefore BYPASSES RLS internally — so each one
-- re-derives the workspace(s) it touches from its arguments and explicitly
-- checks auth_workspace_ids()/is_workspace_manager() itself before writing
-- anything. Do not add a SECURITY DEFINER function to this file without
-- that check; it is the only thing standing between these functions and a
-- cross-workspace write.
--
-- Grants: execute is revoked from PUBLIC and granted only to `authenticated`
-- at the bottom of this file — anonymous callers cannot invoke any of these.

-- ----------------------------------------------------------------------------
-- create_workspace — the "Create Workspace" auth flow. Creates the
-- workspace, its first member (the caller, as owner), and the two 1:1
-- settings rows (with defaults) all in one transaction so a workspace is
-- never left half-initialized.
-- ----------------------------------------------------------------------------
create or replace function create_workspace(p_workspace_name text, p_member_name text, p_contact_email text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create a workspace';
  end if;
  if coalesce(trim(p_workspace_name), '') = '' then
    raise exception 'Workspace name is required';
  end if;

  insert into workspaces (name) values (trim(p_workspace_name)) returning id into v_workspace_id;

  insert into workspace_members (workspace_id, auth_user_id, name, contact_email, account_role, business_role, status)
  values (v_workspace_id, auth.uid(), p_member_name, p_contact_email, 'owner', 'admin', 'active')
  returning id into v_member_id;

  -- Real business defaults, not demo data — the onboarding wizard
  -- overwrites clinic_name/country/currency/logo_url immediately after via
  -- complete_onboarding(); everything else is a genuine technical default.
  insert into clinic_settings (workspace_id) values (v_workspace_id);
  insert into security_prefs (workspace_id) values (v_workspace_id);

  insert into audit_log (workspace_id, actor_member_id, actor_name, action, detail)
  values (v_workspace_id, v_member_id, p_member_name, 'workspace_created', p_workspace_name);

  return v_workspace_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- complete_onboarding — applies the onboarding wizard's clinic identity
-- fields to the settings row create_workspace() already created.
-- ----------------------------------------------------------------------------
create or replace function complete_onboarding(
  p_workspace_id uuid,
  p_clinic_name text,
  p_country text,
  p_currency text,
  p_logo_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_member_name text;
begin
  if not is_workspace_manager(p_workspace_id) then
    raise exception 'Not authorized to complete onboarding for this workspace';
  end if;

  select id, name into v_member_id, v_member_name
  from workspace_members
  where workspace_id = p_workspace_id and auth_user_id = auth.uid()
  limit 1;

  update clinic_settings
  set clinic_name = p_clinic_name,
      country = p_country,
      currency = p_currency,
      logo_url = coalesce(p_logo_url, logo_url)
  where workspace_id = p_workspace_id;

  insert into audit_log (workspace_id, actor_member_id, actor_name, action, detail)
  values (p_workspace_id, v_member_id, v_member_name, 'onboarding_completed', p_clinic_name);
end;
$$;

-- ----------------------------------------------------------------------------
-- accept_invitation — the only write path for workspace_invitations that
-- doesn't require the caller to already be a manager of the workspace (see
-- migration 0010's comment on that table for why this can't just be a
-- broader RLS policy). Validated purely by possession of the invite's
-- unguessable token plus a matching signed-in email.
-- ----------------------------------------------------------------------------
create or replace function accept_invitation(p_token uuid, p_member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite workspace_invitations%rowtype;
  v_member_id uuid;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to accept an invitation';
  end if;

  select * into v_invite
  from workspace_invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'This invitation is invalid or has expired';
  end if;

  v_auth_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_auth_email = '' or v_auth_email <> lower(v_invite.email) then
    raise exception 'This invitation was issued to a different email address';
  end if;

  insert into workspace_members (workspace_id, auth_user_id, name, contact_email, account_role, business_role, status)
  values (v_invite.workspace_id, auth.uid(), p_member_name, v_invite.email, v_invite.account_role, v_invite.business_role, 'active')
  on conflict (workspace_id, auth_user_id)
  do update set status = 'active', name = excluded.name
  returning id into v_member_id;

  update workspace_invitations
  set status = 'accepted', accepted_by = v_member_id, accepted_at = now()
  where id = v_invite.id;

  insert into audit_log (workspace_id, actor_member_id, actor_name, action, detail)
  values (v_invite.workspace_id, v_member_id, p_member_name, 'member_added', 'Accepted invitation');

  return v_member_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- adjust_stock — the single write path for products.quantity_on_hand
-- (manual adjustments; also called internally by the functions below via
-- direct inline logic where a movement needs to be part of a larger
-- transaction). Locks the product row to make concurrent adjustments safe.
-- ----------------------------------------------------------------------------
create or replace function adjust_stock(
  p_product_id uuid,
  p_delta integer,
  p_type movement_type,
  p_reason text,
  p_reference text default null,
  p_note text default null,
  p_batch_lot text default null,
  p_vendor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_qty_before integer;
  v_qty_after integer;
  v_member_id uuid;
  v_movement_id uuid;
begin
  select workspace_id, quantity_on_hand into v_workspace_id, v_qty_before
  from products where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  v_qty_after := v_qty_before + p_delta;
  if v_qty_after < 0 then
    raise exception 'Adjustment would take stock below zero (have %, requested %)', v_qty_before, p_delta;
  end if;

  update products set quantity_on_hand = v_qty_after where id = p_product_id;

  select id into v_member_id from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  insert into inventory_movements (
    workspace_id, product_id, type, quantity, quantity_before, quantity_after,
    reason, reference, performed_by, note, batch_lot, vendor_id
  ) values (
    v_workspace_id, p_product_id, p_type, p_delta, v_qty_before, v_qty_after,
    p_reason, p_reference, v_member_id, p_note, p_batch_lot, p_vendor_id
  ) returning id into v_movement_id;

  insert into audit_log (workspace_id, actor_member_id, action, detail)
  select v_workspace_id, v_member_id, 'stock_adjusted', p_reason;

  return v_movement_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- receive_purchase_order — receives some or all outstanding quantity across
-- a PO's lines in one transaction: bumps quantity_received on each line,
-- increases product stock, records one inbound movement per line, and
-- recomputes the PO's status (received vs. partially_received).
-- p_lines: jsonb array of {"po_line_id": uuid, "quantity": int}. Pass null
-- to receive every line's full outstanding quantity.
-- ----------------------------------------------------------------------------
create or replace function receive_purchase_order(p_po_id uuid, p_lines jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_vendor_id uuid;
  v_member_id uuid;
  v_line record;
  v_qty integer;
  v_qty_before integer;
  v_qty_after integer;
  v_outstanding_total integer;
begin
  select workspace_id, vendor_id into v_workspace_id, v_vendor_id
  from purchase_orders where id = p_po_id for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id into v_member_id from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  for v_line in
    select pol.id, pol.product_id, pol.quantity_ordered, pol.quantity_received
    from purchase_order_lines pol
    where pol.po_id = p_po_id
  loop
    if p_lines is null then
      v_qty := v_line.quantity_ordered - v_line.quantity_received;
    else
      select coalesce((elem ->> 'quantity')::integer, 0) into v_qty
      from jsonb_array_elements(p_lines) elem
      where (elem ->> 'po_line_id')::uuid = v_line.id;
      v_qty := coalesce(v_qty, 0);
    end if;

    if v_qty is null or v_qty = 0 then
      continue;
    end if;
    if v_qty < 0 or v_line.quantity_received + v_qty > v_line.quantity_ordered then
      raise exception 'Invalid receive quantity for PO line %', v_line.id;
    end if;

    update purchase_order_lines set quantity_received = quantity_received + v_qty where id = v_line.id;

    select quantity_on_hand into v_qty_before from products where id = v_line.product_id for update;
    v_qty_after := v_qty_before + v_qty;
    update products set quantity_on_hand = v_qty_after where id = v_line.product_id;

    insert into inventory_movements (
      workspace_id, product_id, type, quantity, quantity_before, quantity_after,
      reason, reference, performed_by, vendor_id
    ) values (
      v_workspace_id, v_line.product_id, 'inbound', v_qty, v_qty_before, v_qty_after,
      'Purchase order received', p_po_id::text, v_member_id, v_vendor_id
    );
  end loop;

  select coalesce(sum(quantity_ordered - quantity_received), 0) into v_outstanding_total
  from purchase_order_lines where po_id = p_po_id;

  if v_outstanding_total = 0 then
    update purchase_orders set status = 'received', received_at = now() where id = p_po_id;
  else
    update purchase_orders set status = 'partially_received' where id = p_po_id;
  end if;

  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  select v_workspace_id, p_po_id,
    case when v_outstanding_total = 0 then 'Order received' else 'Order partially received' end,
    '', coalesce((select name from workspace_members where id = v_member_id), 'System');

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'purchase_order_received');
end;
$$;

-- ----------------------------------------------------------------------------
-- create_sale — records a standalone sale (not tied to adding an implant to
-- a case — see add_implant_to_case below for that path): deducts stock for
-- each line, writes the movements, and computes sales.total.
-- p_lines: jsonb array of {"product_id": uuid, "quantity": int,
-- "unit_price": numeric, "batch_lot": text|null}.
-- ----------------------------------------------------------------------------
create or replace function create_sale(
  p_workspace_id uuid,
  p_sale_number text,
  p_lines jsonb,
  p_patient_id uuid default null,
  p_case_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_sale_id uuid;
  v_total numeric(12,2) := 0;
  v_line jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_qty_before integer;
  v_qty_after integer;
begin
  if p_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id into v_member_id from workspace_members
  where workspace_id = p_workspace_id and auth_user_id = auth.uid() limit 1;

  insert into sales (workspace_id, sale_number, patient_id, case_id, total, sold_by)
  values (p_workspace_id, p_sale_number, p_patient_id, p_case_id, 0, v_member_id)
  returning id into v_sale_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;
    v_unit_price := coalesce((v_line ->> 'unit_price')::numeric, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Sale line quantity must be positive';
    end if;

    select quantity_on_hand into v_qty_before from products
    where id = v_product_id and workspace_id = p_workspace_id for update;
    if not found then
      raise exception 'Product % not found in this workspace', v_product_id;
    end if;
    if v_qty_before < v_quantity then
      raise exception 'Insufficient stock for product %', v_product_id;
    end if;
    v_qty_after := v_qty_before - v_quantity;
    update products set quantity_on_hand = v_qty_after where id = v_product_id;

    insert into sale_lines (workspace_id, sale_id, product_id, quantity, unit_price, batch_lot)
    values (p_workspace_id, v_sale_id, v_product_id, v_quantity, v_unit_price, v_line ->> 'batch_lot');

    insert into inventory_movements (
      workspace_id, product_id, type, quantity, quantity_before, quantity_after,
      reason, reference, performed_by, batch_lot, patient_id, case_id
    ) values (
      p_workspace_id, v_product_id, 'sale', -v_quantity, v_qty_before, v_qty_after,
      'Sale', v_sale_id::text, v_member_id, v_line ->> 'batch_lot', p_patient_id, p_case_id
    );

    v_total := v_total + (v_quantity * v_unit_price);
  end loop;

  update sales set total = v_total where id = v_sale_id;

  insert into audit_log (workspace_id, actor_member_id, action)
  values (p_workspace_id, v_member_id, 'sale_created');

  return v_sale_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- add_implant_to_case — the core clinical workflow: using an implant in a
-- case is simultaneously a stock deduction, a sale, and a case history
-- entry. All three (plus the movement) happen in one transaction so they
-- can never drift apart, mirroring what the original localStorage
-- DataContext did client-side across addImplantToCase + createSale.
-- ----------------------------------------------------------------------------
create or replace function add_implant_to_case(
  p_case_id uuid,
  p_product_id uuid,
  p_tooth text,
  p_quantity integer,
  p_unit_price numeric default null,
  p_batch_lot text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_patient_id uuid;
  v_case_number text;
  v_member_id uuid;
  v_member_name text;
  v_qty_before integer;
  v_qty_after integer;
  v_unit_price numeric(12,2);
  v_sale_id uuid;
  v_usage_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select workspace_id, patient_id, case_number into v_workspace_id, v_patient_id, v_case_number
  from cases where id = p_case_id;
  if not found then
    raise exception 'Case not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id, name into v_member_id, v_member_name from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  select quantity_on_hand, unit_price into v_qty_before, v_unit_price
  from products where id = p_product_id and workspace_id = v_workspace_id for update;
  if not found then
    raise exception 'Product not found in this workspace';
  end if;
  if v_qty_before < p_quantity then
    raise exception 'Insufficient stock for this product';
  end if;
  if p_unit_price is not null then
    v_unit_price := p_unit_price;
  end if;

  v_qty_after := v_qty_before - p_quantity;
  update products set quantity_on_hand = v_qty_after where id = p_product_id;

  insert into case_implant_usages (workspace_id, case_id, product_id, tooth, quantity, batch_lot)
  values (v_workspace_id, p_case_id, p_product_id, p_tooth, p_quantity, p_batch_lot)
  returning id into v_usage_id;

  insert into sales (workspace_id, sale_number, patient_id, case_id, total, sold_by)
  values (v_workspace_id, 'SALE-' || v_case_number || '-' || to_char(now(), 'HH24MISS'), v_patient_id, p_case_id, p_quantity * v_unit_price, v_member_id)
  returning id into v_sale_id;

  insert into sale_lines (workspace_id, sale_id, product_id, quantity, unit_price, batch_lot)
  values (v_workspace_id, v_sale_id, p_product_id, p_quantity, v_unit_price, p_batch_lot);

  insert into inventory_movements (
    workspace_id, product_id, type, quantity, quantity_before, quantity_after,
    reason, reference, performed_by, batch_lot, patient_id, case_id
  ) values (
    v_workspace_id, p_product_id, 'sale', -p_quantity, v_qty_before, v_qty_after,
    'Implant used in case', p_case_id::text, v_member_id, p_batch_lot, v_patient_id, p_case_id
  );

  insert into case_events (workspace_id, case_id, label, description, actor)
  values (v_workspace_id, p_case_id, 'Implant added', format('Tooth %s: qty %s', p_tooth, p_quantity), coalesce(v_member_name, 'System'));

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'sale_created');

  return v_usage_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- create_loan — issues a loan to a lab: deducts stock for each line and
-- records loan_out movements, all in one transaction.
-- p_lines: jsonb array of {"product_id": uuid, "quantity": int, "batch_lot": text|null}.
-- ----------------------------------------------------------------------------
create or replace function create_loan(
  p_workspace_id uuid,
  p_lab_id uuid,
  p_loan_number text,
  p_lines jsonb,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_member_name text;
  v_loan_id uuid;
  v_line jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_qty_before integer;
  v_qty_after integer;
begin
  if p_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id, name into v_member_id, v_member_name from workspace_members
  where workspace_id = p_workspace_id and auth_user_id = auth.uid() limit 1;

  insert into loans (workspace_id, loan_number, lab_id, status, due_date, notes)
  values (p_workspace_id, p_loan_number, p_lab_id, 'open', p_due_date, p_notes)
  returning id into v_loan_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Loan line quantity must be positive';
    end if;

    select quantity_on_hand into v_qty_before from products
    where id = v_product_id and workspace_id = p_workspace_id for update;
    if not found then
      raise exception 'Product % not found in this workspace', v_product_id;
    end if;
    if v_qty_before < v_quantity then
      raise exception 'Insufficient stock for product %', v_product_id;
    end if;
    v_qty_after := v_qty_before - v_quantity;
    update products set quantity_on_hand = v_qty_after where id = v_product_id;

    insert into loan_lines (workspace_id, loan_id, product_id, quantity_loaned, batch_lot)
    values (p_workspace_id, v_loan_id, v_product_id, v_quantity, v_line ->> 'batch_lot');

    insert into inventory_movements (
      workspace_id, product_id, type, quantity, quantity_before, quantity_after,
      reason, reference, performed_by, batch_lot, lab_id
    ) values (
      p_workspace_id, v_product_id, 'loan_out', -v_quantity, v_qty_before, v_qty_after,
      'Loan issued', v_loan_id::text, v_member_id, v_line ->> 'batch_lot', p_lab_id
    );
  end loop;

  insert into loan_events (workspace_id, loan_id, label, description, actor)
  values (p_workspace_id, v_loan_id, 'Loan issued', coalesce(p_notes, ''), coalesce(v_member_name, 'System'));

  insert into audit_log (workspace_id, actor_member_id, action)
  values (p_workspace_id, v_member_id, 'loan_created');

  return v_loan_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- return_loan_lines — processes returns (and/or losses) against one or more
-- lines of an open loan, restocks returned quantities, and recomputes the
-- loan's status (closed once every line is fully returned/lost).
-- p_returns: jsonb array of {"loan_line_id": uuid, "quantity_returned": int,
-- "quantity_lost": int, "lost_reason": text|null}.
-- ----------------------------------------------------------------------------
create or replace function return_loan_lines(p_loan_id uuid, p_returns jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_member_id uuid;
  v_member_name text;
  v_line record;
  v_ret jsonb;
  v_qty_returned integer;
  v_qty_lost integer;
  v_lost_reason text;
  v_qty_before integer;
  v_qty_after integer;
  v_all_closed boolean;
  v_any_returned boolean;
begin
  select workspace_id into v_workspace_id from loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id, name into v_member_id, v_member_name from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  for v_ret in select * from jsonb_array_elements(p_returns)
  loop
    select * into v_line from loan_lines where id = (v_ret ->> 'loan_line_id')::uuid and loan_id = p_loan_id;
    if not found then
      raise exception 'Loan line not found on this loan';
    end if;

    v_qty_returned := coalesce((v_ret ->> 'quantity_returned')::integer, 0);
    v_qty_lost := coalesce((v_ret ->> 'quantity_lost')::integer, 0);
    v_lost_reason := v_ret ->> 'lost_reason';

    if v_line.quantity_returned + v_line.quantity_lost + v_qty_returned + v_qty_lost > v_line.quantity_loaned then
      raise exception 'Return/loss quantity exceeds outstanding loaned quantity for line %', v_line.id;
    end if;

    update loan_lines
    set quantity_returned = quantity_returned + v_qty_returned,
        quantity_lost = quantity_lost + v_qty_lost,
        lost_reason = coalesce(v_lost_reason, lost_reason)
    where id = v_line.id;

    if v_qty_returned > 0 then
      select quantity_on_hand into v_qty_before from products where id = v_line.product_id for update;
      v_qty_after := v_qty_before + v_qty_returned;
      update products set quantity_on_hand = v_qty_after where id = v_line.product_id;

      insert into inventory_movements (
        workspace_id, product_id, type, quantity, quantity_before, quantity_after,
        reason, reference, performed_by, batch_lot
      ) values (
        v_workspace_id, v_line.product_id, 'loan_return', v_qty_returned, v_qty_before, v_qty_after,
        'Loan returned', p_loan_id::text, v_member_id, v_line.batch_lot
      );
    end if;

    if v_qty_lost > 0 then
      insert into inventory_movements (
        workspace_id, product_id, type, quantity, quantity_before, quantity_after,
        reason, reference, performed_by, note, batch_lot
      ) values (
        v_workspace_id, v_line.product_id, 'lost', 0,
        (select quantity_on_hand from products where id = v_line.product_id),
        (select quantity_on_hand from products where id = v_line.product_id),
        'Loan item lost', p_loan_id::text, v_member_id, v_lost_reason, v_line.batch_lot
      );
    end if;
  end loop;

  select
    bool_and(quantity_returned + quantity_lost = quantity_loaned),
    bool_or(quantity_returned + quantity_lost > 0)
  into v_all_closed, v_any_returned
  from loan_lines where loan_id = p_loan_id;

  update loans
  set status = case when v_all_closed then 'closed' when v_any_returned then 'partially_returned' else status end
  where id = p_loan_id;

  insert into loan_events (workspace_id, loan_id, label, description, actor)
  values (v_workspace_id, p_loan_id, 'Loan updated', 'Return/loss recorded', coalesce(v_member_name, 'System'));

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'loan_returned');
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants — revoke the default PUBLIC execute grant Postgres adds to every
-- new function, then grant explicitly to authenticated only.
-- ----------------------------------------------------------------------------
revoke execute on function create_workspace(text, text, text) from public;
revoke execute on function complete_onboarding(uuid, text, text, text, text) from public;
revoke execute on function accept_invitation(uuid, text) from public;
revoke execute on function adjust_stock(uuid, integer, movement_type, text, text, text, text, uuid) from public;
revoke execute on function receive_purchase_order(uuid, jsonb) from public;
revoke execute on function create_sale(uuid, text, jsonb, uuid, uuid) from public;
revoke execute on function add_implant_to_case(uuid, uuid, text, integer, numeric, text) from public;
revoke execute on function create_loan(uuid, uuid, text, jsonb, date, text) from public;
revoke execute on function return_loan_lines(uuid, jsonb) from public;

grant execute on function create_workspace(text, text, text) to authenticated;
grant execute on function complete_onboarding(uuid, text, text, text, text) to authenticated;
grant execute on function accept_invitation(uuid, text) to authenticated;
grant execute on function adjust_stock(uuid, integer, movement_type, text, text, text, text, uuid) to authenticated;
grant execute on function receive_purchase_order(uuid, jsonb) to authenticated;
grant execute on function create_sale(uuid, text, jsonb, uuid, uuid) to authenticated;
grant execute on function add_implant_to_case(uuid, uuid, text, integer, numeric, text) to authenticated;
grant execute on function create_loan(uuid, uuid, text, jsonb, date, text) to authenticated;
grant execute on function return_loan_lines(uuid, jsonb) to authenticated;

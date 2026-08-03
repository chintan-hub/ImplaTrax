-- ============================================================================
-- ImplaTrax — Supabase migration 0014: fix missing audit_log.actor_name
-- ============================================================================
-- audit_log.actor_name is NOT NULL (migration 0009), but nine RPCs across
-- migrations 0011/0013 insert into audit_log without it — every one of
-- them fails with a not-null violation the moment it's actually called
-- (caught by live end-to-end verification against a real project: adjust_stock,
-- the single most-used RPC in the app, errored on its very first real call).
-- Every function below is CREATE OR REPLACE with its parameter list
-- unchanged, so no DROP/re-GRANT is needed — only the audit_log insert
-- itself changes, adding actor_name via the same
-- `coalesce((select name from workspace_members where id = v_member_id), 'System')`
-- pattern every purchase_order_events/case_events/loan_events insert in
-- these same functions already uses.

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

  insert into audit_log (workspace_id, actor_member_id, actor_name, action, detail)
  select v_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'stock_adjusted', p_reason;

  return v_movement_id;
end;
$$;

create or replace function create_sale(
  p_workspace_id uuid,
  p_sale_number text,
  p_lines jsonb,
  p_patient_id uuid,
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
  if p_patient_id is null then
    raise exception 'A patient is required to record a sale';
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

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (p_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'sale_created');

  return v_sale_id;
end;
$$;

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
  if v_patient_id is null then
    raise exception 'A patient is required to record a sale';
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

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce(v_member_name, 'System'), 'sale_created');

  return v_usage_id;
end;
$$;

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

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (p_workspace_id, v_member_id, coalesce(v_member_name, 'System'), 'loan_created');

  return v_loan_id;
end;
$$;

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

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce(v_member_name, 'System'), 'loan_returned');
end;
$$;

create or replace function void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_sale_number text;
  v_case_id uuid;
  v_member_id uuid;
  v_line record;
  v_qty_before integer;
  v_qty_after integer;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to void a sale';
  end if;

  select workspace_id, sale_number, case_id into v_workspace_id, v_sale_number, v_case_id
  from sales where id = p_sale_id;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;
  if exists (select 1 from sales where id = p_sale_id and voided_at is not null) then
    raise exception 'This sale has already been voided';
  end if;

  select id into v_member_id from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  for v_line in select * from sale_lines where sale_id = p_sale_id
  loop
    select quantity_on_hand into v_qty_before from products where id = v_line.product_id for update;
    v_qty_after := v_qty_before + v_line.quantity;
    update products set quantity_on_hand = v_qty_after where id = v_line.product_id;

    insert into inventory_movements (
      workspace_id, product_id, type, quantity, quantity_before, quantity_after,
      reason, reference, performed_by, batch_lot, patient_id, case_id
    )
    select v_workspace_id, v_line.product_id, 'adjustment', v_line.quantity, v_qty_before, v_qty_after,
      'Sale voided: ' || trim(p_reason), v_sale_number, v_member_id, v_line.batch_lot, s.patient_id, s.case_id
    from sales s where s.id = p_sale_id;
  end loop;

  update sales set voided_at = now(), void_reason = trim(p_reason) where id = p_sale_id;

  if v_case_id is not null then
    insert into case_events (workspace_id, case_id, label, description, actor)
    values (v_workspace_id, v_case_id, 'Sale Voided', format('%s was voided: %s. Stock was restored.', v_sale_number, trim(p_reason)),
      coalesce((select name from workspace_members where id = v_member_id), 'System'));
  end if;

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'sale_created');
end;
$$;

create or replace function create_purchase_order(
  p_workspace_id uuid, p_po_number text, p_vendor_id uuid, p_eta date, p_lines jsonb, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_po_id uuid;
  v_line jsonb;
  v_line_count integer := 0;
begin
  if p_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;

  select id into v_member_id from workspace_members
  where workspace_id = p_workspace_id and auth_user_id = auth.uid() limit 1;

  insert into purchase_orders (workspace_id, po_number, vendor_id, status, eta, notes)
  values (p_workspace_id, p_po_number, p_vendor_id, 'draft', p_eta, p_notes)
  returning id into v_po_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into purchase_order_lines (workspace_id, po_id, product_id, quantity_ordered, unit_cost)
    values (p_workspace_id, v_po_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'quantity_ordered')::integer, coalesce((v_line ->> 'unit_cost')::numeric, 0));
    v_line_count := v_line_count + 1;
  end loop;

  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  values (p_workspace_id, v_po_id, 'Purchase Order Created',
    format('Draft created with %s line item(s). Inventory is not affected until items are received.', v_line_count),
    coalesce((select name from workspace_members where id = v_member_id), 'System'));

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (p_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'purchase_order_created');

  return v_po_id;
end;
$$;

create or replace function receive_purchase_order(p_po_id uuid, p_lines jsonb default null, p_photo_urls text[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_vendor_id uuid;
  v_status po_status;
  v_member_id uuid;
  v_batch_tracking_enabled boolean;
  v_line record;
  v_qty integer;
  v_lot_number text;
  v_expiry_date date;
  v_qty_before integer;
  v_qty_after integer;
  v_outstanding_total integer;
  v_is_partial boolean := false;
  v_remaining integer;
begin
  select workspace_id, vendor_id, status into v_workspace_id, v_vendor_id, v_status
  from purchase_orders where id = p_po_id for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;
  if v_workspace_id not in (select auth_workspace_ids()) then
    raise exception 'Not a member of this workspace';
  end if;
  if v_status not in ('submitted', 'confirmed', 'partially_received') then
    raise exception 'This purchase order cannot be received in its current status';
  end if;

  select id into v_member_id from workspace_members
  where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  select batch_lot_tracking_enabled into v_batch_tracking_enabled
  from clinic_settings where workspace_id = v_workspace_id;

  -- Pass 1: validate (lot requirement, partial-receipt-photo requirement)
  -- before writing anything, mirroring the client's own validate-then-write
  -- ordering — a rejected call must never touch stock or movements.
  for v_line in
    select pol.id, pol.product_id, pol.quantity_ordered, pol.quantity_received, p.name as product_name
    from purchase_order_lines pol join products p on p.id = pol.product_id
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

    if v_qty > 0 and v_batch_tracking_enabled then
      select elem ->> 'lot_number' into v_lot_number
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) elem
      where (elem ->> 'po_line_id')::uuid = v_line.id;
      if coalesce(trim(v_lot_number), '') = '' then
        raise exception 'A lot/batch number is required to receive %', v_line.product_name;
      end if;
    end if;

    v_remaining := v_line.quantity_ordered - v_line.quantity_received;
    if v_qty < v_remaining then
      v_is_partial := true;
    end if;
  end loop;

  if v_is_partial and (p_photo_urls is null or array_length(p_photo_urls, 1) is null or array_length(p_photo_urls, 1) = 0) then
    raise exception 'Please attach at least one photo of the delivery slip or package to document this partial receipt';
  end if;

  -- Pass 2: write.
  for v_line in
    select pol.id, pol.product_id, pol.quantity_ordered, pol.quantity_received
    from purchase_order_lines pol
    where pol.po_id = p_po_id
  loop
    if p_lines is null then
      v_qty := v_line.quantity_ordered - v_line.quantity_received;
      v_lot_number := null;
      v_expiry_date := null;
    else
      select coalesce((elem ->> 'quantity')::integer, 0), elem ->> 'lot_number', (elem ->> 'expiry_date')::date
      into v_qty, v_lot_number, v_expiry_date
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
      reason, reference, performed_by, vendor_id, batch_lot, photo_urls
    ) values (
      v_workspace_id, v_line.product_id, 'inbound', v_qty, v_qty_before, v_qty_after,
      'Purchase order received', p_po_id::text, v_member_id, v_vendor_id, v_lot_number, coalesce(p_photo_urls, '{}')
    );

    if coalesce(trim(v_lot_number), '') <> '' then
      insert into product_batches (workspace_id, product_id, lot_number, expiry_date, quantity, reference)
      select v_workspace_id, v_line.product_id, v_lot_number, v_expiry_date, v_qty, po_number
      from purchase_orders where id = p_po_id;
    end if;
  end loop;

  select coalesce(sum(quantity_ordered - quantity_received), 0) into v_outstanding_total
  from purchase_order_lines where po_id = p_po_id;

  if v_outstanding_total = 0 then
    update purchase_orders
    set status = 'received', received_at = now(), photo_urls = photo_urls || coalesce(p_photo_urls, '{}')
    where id = p_po_id;
  else
    update purchase_orders
    set status = 'partially_received', photo_urls = photo_urls || coalesce(p_photo_urls, '{}')
    where id = p_po_id;
  end if;

  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  select v_workspace_id, p_po_id,
    case when v_outstanding_total = 0 then 'Stock Fully Received' else 'Stock Partially Received' end,
    case when v_outstanding_total = 0 then 'All ordered quantities have now been received; inventory updated.'
      else 'Some units received in this receipt; inventory updated. Order remains open for the rest.' end,
    coalesce((select name from workspace_members where id = v_member_id), 'System');

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'purchase_order_received');
end;
$$;

create or replace function submit_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_status po_status;
  v_member_id uuid;
begin
  select workspace_id, status into v_workspace_id, v_status from purchase_orders where id = p_po_id;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_workspace_id not in (select auth_workspace_ids()) then raise exception 'Not a member of this workspace'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft purchase order can be submitted'; end if;

  select id into v_member_id from workspace_members where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  update purchase_orders set status = 'submitted', submitted_at = now() where id = p_po_id;
  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  values (v_workspace_id, p_po_id, 'Submitted to Vendor', 'Purchase order sent to the vendor.',
    coalesce((select name from workspace_members where id = v_member_id), 'System'));

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'purchase_order_submitted');
end;
$$;

create or replace function cancel_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_status po_status;
  v_member_id uuid;
begin
  select workspace_id, status into v_workspace_id, v_status from purchase_orders where id = p_po_id;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_workspace_id not in (select auth_workspace_ids()) then raise exception 'Not a member of this workspace'; end if;
  if v_status not in ('draft', 'submitted', 'confirmed') then raise exception 'This purchase order can no longer be cancelled'; end if;

  select id into v_member_id from workspace_members where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  update purchase_orders set status = 'cancelled' where id = p_po_id;
  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  values (v_workspace_id, p_po_id, 'Purchase Order Cancelled', 'This purchase order was cancelled and will not be received.',
    coalesce((select name from workspace_members where id = v_member_id), 'System'));

  insert into audit_log (workspace_id, actor_member_id, actor_name, action)
  values (v_workspace_id, v_member_id, coalesce((select name from workspace_members where id = v_member_id), 'System'), 'purchase_order_cancelled');
end;
$$;

-- ============================================================================
-- ImplaTrax — Supabase migration 0013: sale voiding, PO lifecycle RPCs,
-- workspace data wipe/reset
-- ============================================================================
-- Three gaps found while wiring the app's DataContext to this schema:
-- 1. `sales` never grew voided_at/void_reason columns — voiding was a
--    client-only concept in the original localStorage build. Adding them
--    plus a proper void_sale() RPC (restores stock, records adjustment
--    movements, appends a case_event) mirrors createSale's own rigor.
-- 2. Purchase Order creation/submission/cancellation/photo-attach never got
--    RPCs in 0011 (only receive_purchase_order did, since it's the one path
--    with real stock arithmetic) — they're multi-table writes too
--    (purchase_orders + purchase_order_lines + purchase_order_events), so
--    wrapping them keeps "every multi-row business write is one atomic
--    RPC" true everywhere, not just where stock happens to be involved.
-- 3. The new Wipe/Reset Data admin action needs a workspace-scoped purge
--    that respects FK dependency order and never touches other workspaces
--    or this workspace's own account/settings rows.

alter table sales
  add column voided_at timestamptz,
  add column void_reason text;

alter type audit_action add value 'workspace_data_wiped';

-- ----------------------------------------------------------------------------
-- void_sale — inverse of create_sale: restores every line's quantity to
-- stock, records one 'adjustment' movement per line, marks the sale voided,
-- and (if case-linked) appends a case_event — matching the exact behavior
-- of the original client-side voidSale() in DataContext.tsx.
-- ----------------------------------------------------------------------------
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

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'sale_created');
end;
$$;

-- ----------------------------------------------------------------------------
-- create_purchase_order — header + lines + the creation history event, one
-- transaction. p_lines: jsonb array of {"product_id","quantity_ordered","unit_cost"}.
-- ----------------------------------------------------------------------------
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

  insert into audit_log (workspace_id, actor_member_id, action)
  values (p_workspace_id, v_member_id, 'purchase_order_created');

  return v_po_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- receive_purchase_order — REPLACES migration 0011's version, which only
-- did stock arithmetic and never enforced (or even recorded) two CRITICAL,
-- locked business rules that the original client-side DataContext.ts
-- always enforced: batch/lot capture at receipt whenever Batch/Lot
-- Tracking is on (PROJECT.md §3 point 5, not gated by Product.batchTracked),
-- and a mandatory delivery photo whenever the receipt is partial. Both are
-- now enforced here, server-side, matching the client exactly — plus
-- product_batches rows and per-movement/per-PO photo_urls, neither of
-- which 0011's version wrote at all. The parameter list changes (adds
-- p_photo_urls), so the old 2-argument overload is dropped first rather
-- than left dangling alongside this one.
-- ----------------------------------------------------------------------------
drop function if exists receive_purchase_order(uuid, jsonb);

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

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'purchase_order_received');
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

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'purchase_order_submitted');
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

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'purchase_order_cancelled');
end;
$$;

create or replace function attach_po_photo(p_po_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_member_id uuid;
begin
  select workspace_id into v_workspace_id from purchase_orders where id = p_po_id;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_workspace_id not in (select auth_workspace_ids()) then raise exception 'Not a member of this workspace'; end if;

  select id into v_member_id from workspace_members where workspace_id = v_workspace_id and auth_user_id = auth.uid() limit 1;

  update purchase_orders set photo_url = p_photo_url where id = p_po_id;
  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  values (v_workspace_id, p_po_id, case when p_photo_url is not null then 'Photo Attached' else 'Photo Removed' end,
    case when p_photo_url is not null then 'A reference photo was attached to this purchase order.' else 'The attached photo was removed.' end,
    coalesce((select name from workspace_members where id = v_member_id), 'System'));
end;
$$;

-- ----------------------------------------------------------------------------
-- wipe_workspace_data — the Settings > Danger Zone "Wipe / Reset Data"
-- action. Deletes every tenant-specific business row for one workspace, in
-- FK dependency order (children before parents), while leaving the
-- workspace itself, its members, clinic_settings, security_prefs, and
-- audit_log untouched — resetting is not the same as deleting the account.
-- Restricted to workspace managers, exactly like every other destructive
-- workspace-level action in this schema.
-- ----------------------------------------------------------------------------
create or replace function wipe_workspace_data(p_workspace_id uuid)
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
    raise exception 'Only a workspace owner, super admin, or admin can wipe workspace data';
  end if;

  select id, name into v_member_id, v_member_name from workspace_members
  where workspace_id = p_workspace_id and auth_user_id = auth.uid() limit 1;

  delete from sale_lines where workspace_id = p_workspace_id;
  delete from sales where workspace_id = p_workspace_id;
  delete from loan_lines where workspace_id = p_workspace_id;
  delete from loan_events where workspace_id = p_workspace_id;
  delete from loans where workspace_id = p_workspace_id;
  delete from case_implant_usages where workspace_id = p_workspace_id;
  delete from case_events where workspace_id = p_workspace_id;
  delete from cases where workspace_id = p_workspace_id;
  delete from patients where workspace_id = p_workspace_id;
  delete from purchase_order_events where workspace_id = p_workspace_id;
  delete from purchase_order_lines where workspace_id = p_workspace_id;
  delete from purchase_orders where workspace_id = p_workspace_id;
  delete from inventory_movements where workspace_id = p_workspace_id;
  delete from product_batches where workspace_id = p_workspace_id;
  delete from products where workspace_id = p_workspace_id;
  delete from vendor_manufacturers where vendor_id in (select id from vendors where workspace_id = p_workspace_id);
  delete from vendors where workspace_id = p_workspace_id;
  delete from doctors where workspace_id = p_workspace_id;
  delete from labs where workspace_id = p_workspace_id;
  delete from notifications where workspace_id = p_workspace_id;

  insert into audit_log (workspace_id, actor_member_id, actor_name, action, detail)
  values (p_workspace_id, v_member_id, coalesce(v_member_name, 'System'), 'workspace_data_wiped', 'Workspace data wiped');
end;
$$;

grant execute on function void_sale(uuid, text) to authenticated;
grant execute on function create_purchase_order(uuid, text, uuid, date, jsonb, text) to authenticated;
grant execute on function receive_purchase_order(uuid, jsonb, text[]) to authenticated;
grant execute on function submit_purchase_order(uuid) to authenticated;
grant execute on function cancel_purchase_order(uuid) to authenticated;
grant execute on function attach_po_photo(uuid, text) to authenticated;
grant execute on function wipe_workspace_data(uuid) to authenticated;

-- ============================================================================
-- ImplaTrax — Supabase migration 0012: photo attachments
-- ============================================================================
-- Adds a photo_urls array column to every transactional table that can carry
-- evidence photos, plus updates receive_purchase_order() to enforce the
-- mandatory-partial-receipt-photo business rule at the database layer, not
-- just in the client (DataContext.receivePurchaseOrder mirrors this exactly
-- — see its own doc comment).
--
-- Storage bucket layout (bucket name: "attachments", created via the
-- Supabase dashboard/CLI, not SQL): every object path is
--   /workspaces/{workspace_id}/{module}/{record_id}/{filename}
-- where {module} is one of "purchase-orders", "sales", "loans", and
-- {record_id} is that row's id (the purchase_order/sale/loan id — not the
-- inventory_movements row, since a single receipt/sale/loan action can fan
-- out into several movements that all share the same evidence photos).
-- photo_urls stores the object path returned by Storage, not a signed URL —
-- callers resolve a path to a viewable URL at read time via
-- supabase.storage.from('attachments').createSignedUrl(path, ...), which is
-- what makes bucket-level RLS (path must start with the caller's own
-- workspace_id) the actual access-control boundary, not the URL itself.

alter table inventory_movements add column photo_urls text[] not null default '{}';
alter table purchase_orders add column photo_urls text[] not null default '{}';
alter table sales add column photo_urls text[] not null default '{}';
alter table loans add column photo_urls text[] not null default '{}';

comment on column purchase_orders.photo_urls is 'Evidence photos accumulated from receive_purchase_order() calls — append-only across multiple partial receipts, distinct from photo_url (a single ad-hoc reference photo attachable any time). Mandatory (enforced in receive_purchase_order) whenever a receipt is partial.';
comment on column inventory_movements.photo_urls is 'Evidence photos captured at the time of this movement — same array as the parent purchase_orders/sales/loans row''s photo_urls for movements created by that action, since the photos document the whole transaction, not a single product line.';

-- ----------------------------------------------------------------------------
-- receive_purchase_order — replaced (not just altered) to add the
-- p_photo_urls parameter and enforce the mandatory-partial-receipt-photo
-- rule. Mirrors DataContext.receivePurchaseOrder's isPartialReceive check
-- exactly: a receipt is partial the moment any line's received quantity in
-- this call comes in short of what was outstanding for it beforehand —
-- whether under-received this time or skipped entirely.
-- ----------------------------------------------------------------------------
drop function if exists receive_purchase_order(uuid, jsonb);

create or replace function receive_purchase_order(p_po_id uuid, p_lines jsonb default null, p_photo_urls text[] default '{}')
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
  v_is_partial boolean := false;
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

  -- First pass: determine whether this receipt is partial before touching
  -- any state, so a missing-photo rejection never leaves a half-applied
  -- receipt behind.
  for v_line in
    select pol.id, pol.quantity_ordered, pol.quantity_received
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
    if coalesce(v_qty, 0) < (v_line.quantity_ordered - v_line.quantity_received) then
      v_is_partial := true;
    end if;
  end loop;

  if v_is_partial and coalesce(array_length(p_photo_urls, 1), 0) = 0 then
    raise exception 'Please attach at least one photo of the delivery slip or package to document this partial receipt.';
  end if;

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
      reason, reference, performed_by, vendor_id, photo_urls
    ) values (
      v_workspace_id, v_line.product_id, 'inbound', v_qty, v_qty_before, v_qty_after,
      'Purchase order received', p_po_id::text, v_member_id, v_vendor_id, p_photo_urls
    );
  end loop;

  select coalesce(sum(quantity_ordered - quantity_received), 0) into v_outstanding_total
  from purchase_order_lines where po_id = p_po_id;

  if v_outstanding_total = 0 then
    update purchase_orders set status = 'received', received_at = now() where id = p_po_id;
  else
    update purchase_orders set status = 'partially_received' where id = p_po_id;
  end if;

  if coalesce(array_length(p_photo_urls, 1), 0) > 0 then
    update purchase_orders set photo_urls = photo_urls || p_photo_urls where id = p_po_id;
  end if;

  insert into purchase_order_events (workspace_id, po_id, label, description, actor)
  select v_workspace_id, p_po_id,
    case when v_outstanding_total = 0 then 'Order received' else 'Order partially received' end,
    '', coalesce((select name from workspace_members where id = v_member_id), 'System');

  insert into audit_log (workspace_id, actor_member_id, action)
  values (v_workspace_id, v_member_id, 'purchase_order_received');
end;
$$;

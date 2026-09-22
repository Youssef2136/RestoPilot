-- ────────────────────────────────────────────────────────────────────────────
-- Phase 12 (branch reports) — read-time operational reporting over the
-- captured substrate (spec 013 T002; plan.md D1–D5; contracts §1–§2).
--
-- Reuse principle: NO new engines, tables, or write paths. Two security
-- definer RPCs derive every figure at read time from rounds (captured
-- subtotal/tax_total, the Phase 10 void overlay) joined to sessions
-- (channel type). §23's anti-drift rule: no materialized view, no summary
-- table, no counters — D1.
--
-- Reach: private.has_branch_role verbatim (009–012 convention) — owner
-- (branch_id null) any branch of the restaurant; branch manager their
-- branch; cashier/kitchen and anon refused with the same generic 42501
-- (the 009 indistinguishability posture). Identity is resolved via
-- private.ops_profile_id() like every staff RPC since 009.
--
-- The void log is NOT a new RPC: get_audit_log (Phase 10) already
-- authorizes exactly owner/manager and filters by action — the client
-- passes p_action='round.void' (plan D3).
-- ────────────────────────────────────────────────────────────────────────────

-- ── §1 get_branch_sales_report (contracts §1) ───────────────────────────────
-- One bucket per call: p_period ('day' | 'week' | 'month') + p_anchor_date
-- (any date inside the wanted bucket; the database computes the boundaries
-- with date_trunc — week buckets are Monday-start, Postgres default).
-- Channel vocabulary is the SESSION type spelling ('dine-in', Phase 4 seed) —
-- the payload normalizes to the contract's machine names.
create or replace function public.get_branch_sales_report(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_period text,
  p_anchor_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  -- Validation first (the 009 vocabulary order: validate, identify, reach,
  -- read) — a bad period is a validation refusal, indistinguishable in shape
  -- from a reach refusal.
  if p_period not in ('day', 'week', 'month') then
    raise exception 'validation failed' using errcode = 'P0001';
  end if;
  if p_anchor_date is null then
    raise exception 'validation failed' using errcode = 'P0001';
  end if;

  v_profile_id := private.ops_profile_id();
  if v_profile_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Reach (has_branch_role verbatim): owners pass with any branch of the
  -- restaurant; managers only with their own branch; cashier/kitchen never.
  if not private.has_branch_role(
    v_profile_id, p_restaurant_id, p_branch_id,
    array['branch_manager']::public.staff_role[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Bucket boundaries in the database's timezone (plan D2). date_trunc
  -- 'week' truncates to Monday — the spec's ISO week rule.
  v_from := case p_period
    when 'day' then date_trunc('day', p_anchor_date::timestamptz)
    when 'week' then date_trunc('week', p_anchor_date::timestamptz)
    else date_trunc('month', p_anchor_date::timestamptz)
  end;
  v_to := case p_period
    when 'day' then v_from + interval '1 day'
    when 'week' then v_from + interval '7 days'
    else v_from + interval '1 month'
  end;

  select jsonb_build_object(
    'branch_id', p_branch_id,
    'period', p_period,
    'from', v_from,
    'to', v_to,
    'rounds_submitted', coalesce(all_r.n, 0),
    'rounds_voided', coalesce(all_r.voided_n, 0),
    'net_total', coalesce(net_r.net_total, 0),
    'net_tax_total', coalesce(net_r.net_tax_total, 0),
    'channels', coalesce(ch.rows, '[]'::jsonb),
    'best_sellers', coalesce(bs.rows, '[]'::jsonb)
  )
  into v_result
  from
    -- Submitted = every round whose SESSION opened in the bucket (the
    -- session is the receipt's anchor — plan D4); voided counted separately.
    (
      select count(*) as n, count(*) filter (where r.voided) as voided_n
      from public.rounds r
      join public.sessions s on s.id = r.session_id
      where s.branch_id = p_branch_id
        and s.opened_at >= v_from and s.opened_at < v_to
    ) all_r
    left join lateral (
      -- Net money = captured money over NON-voided rounds only (FR-004).
      select sum(r.subtotal + r.tax_total) as net_total,
             sum(r.tax_total) as net_tax_total
      from public.rounds r
      join public.sessions s on s.id = r.session_id
      where s.branch_id = p_branch_id
        and s.opened_at >= v_from and s.opened_at < v_to
        and not r.voided
    ) net_r on true
    left join lateral (
      -- Channel breakdown: all three types present, zero included. The
      -- session type spelling is 'dine-in' (the 004 seed vocabulary); the
      -- payload normalizes it to the contract's 'dine_in'.
      select coalesce(jsonb_agg(jsonb_build_object(
        'type', case t.type when 'dine-in' then 'dine_in' else t.type end,
        'rounds', coalesce(c.n, 0),
        'net_total', coalesce(c.net_total, 0)
      ) order by case t.type when 'dine-in' then 'dine_in' else t.type end), '[]'::jsonb) as rows
      from (values ('dine-in'), ('delivery'), ('takeaway')) as t(type)
      left join lateral (
        select count(*) as n, sum(r2.subtotal + r2.tax_total) as net_total
        from public.rounds r2
        join public.sessions s2 on s2.id = r2.session_id
        where s2.branch_id = p_branch_id
          and s2.opened_at >= v_from and s2.opened_at < v_to
          and s2.type = t.type
          and not r2.voided
      ) c on true
    ) ch on true
    left join lateral (
      -- Best-sellers: captured quantity net of voids, ranked, capped at 10
      -- (deterministic tie-break on the item's menu name).
      select coalesce(jsonb_agg(jsonb_build_object(
        'item_id', item_agg.item_id,
        'name', item_agg.name,
        'quantity', item_agg.qty
      ) order by item_agg.qty desc, item_agg.name asc), '[]'::jsonb) as rows
      from (
        select ri.item_id, mi.name, sum(ri.quantity) as qty
        from public.round_items ri
        join public.rounds r3 on r3.id = ri.round_id
        join public.sessions s3 on s3.id = r3.session_id
        join public.menu_items mi on mi.id = ri.item_id
        where s3.branch_id = p_branch_id
          and s3.opened_at >= v_from and s3.opened_at < v_to
          and not r3.voided
        group by ri.item_id, mi.name
        order by qty desc, mi.name asc
        limit 10
      ) item_agg
    ) bs on true;

  return v_result;
end;
$$;

-- ── §2 get_branch_void_report (contracts §2) ────────────────────────────────
-- The void ledger as the audit projection: rows the client renders directly
-- (who / which round / when / why). get_audit_log already covers the
-- trail-with-filters case; this view adds the void-overlay join (round
-- money at void time) that the audit row alone does not carry.
create or replace function public.get_branch_void_report(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'validation failed' using errcode = 'P0001';
  end if;

  v_profile_id := private.ops_profile_id();
  if v_profile_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not private.has_branch_role(
    v_profile_id, p_restaurant_id, p_branch_id,
    array['branch_manager']::public.staff_role[]
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'round_id', r.id,
      'voided_at', r.voided_at,
      'void_reason', r.void_reason,
      'voided_by_profile_id', r.voided_by_profile_id,
      'voided_by_name', p.display_name,
      'session_id', r.session_id,
      'session_type', s.type,
      'captured_total', r.subtotal + r.tax_total
    ) order by r.voided_at desc nulls last)
    from public.rounds r
    join public.sessions s on s.id = r.session_id
    left join public.profiles p on p.id = r.voided_by_profile_id
    where s.branch_id = p_branch_id
      and r.voided
    limit p_limit
  ), '[]'::jsonb);
end;
$$;

-- ── §3 grants (contracts §3) ────────────────────────────────────────────────
-- The 011 posture: execute to authenticated only; anon/public revoked.
revoke execute on function public.get_branch_sales_report(uuid, uuid, text, date) from public;
revoke execute on function public.get_branch_void_report(uuid, uuid, integer) from public;
grant execute on function public.get_branch_sales_report(uuid, uuid, text, date) to authenticated;
grant execute on function public.get_branch_void_report(uuid, uuid, integer) to authenticated;

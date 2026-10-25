-- Late fees are paid separately from the flat price: a payment of type 'Late fee'
-- is kept on record but never applied to instalments and never reduces the amount due.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_type_check
  CHECK (type IN ('Booking money','Down payment','Instalment','Car parking','Other','Late fee'));

CREATE OR REPLACE FUNCTION public.admin_reallocate_payments(_client_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE left_amt numeric; r record; ap numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(sum(amount), 0) INTO left_amt FROM public.payments WHERE client_id = _client_id AND type <> 'Late fee';
  FOR r IN SELECT id, amount, paid_amount FROM public.instalments WHERE client_id = _client_id ORDER BY due_date, id LOOP
    ap := LEAST(r.amount, GREATEST(left_amt, 0));
    IF ap <> r.paid_amount THEN UPDATE public.instalments SET paid_amount = ap WHERE id = r.id; END IF;
    left_amt := left_amt - ap;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.client_balances WITH (security_invoker = true) AS
SELECT c.id AS client_id, c.total_price,
  COALESCE(p.total_paid, 0) AS total_paid,
  c.total_price - COALESCE(p.total_paid, 0) AS amount_due,
  CASE WHEN c.total_price > 0 THEN round(COALESCE(p.total_paid,0) * 100 / c.total_price, 1) ELSE 0 END AS pct_paid,
  lp.paid_on AS last_payment_on, lp.amount AS last_payment_amount,
  ni.due_date AS next_due_date, ni.remaining AS next_due_amount,
  COALESCE(od.overdue, 0) AS overdue_amount,
  COALESCE(lf.late_fee_paid, 0) AS late_fee_paid
FROM public.clients c
LEFT JOIN LATERAL (SELECT sum(amount) AS total_paid FROM public.payments WHERE client_id = c.id AND type <> 'Late fee') p ON true
LEFT JOIN LATERAL (SELECT paid_on, amount FROM public.payments WHERE client_id = c.id ORDER BY paid_on DESC, created_at DESC LIMIT 1) lp ON true
LEFT JOIN LATERAL (SELECT due_date, amount - paid_amount AS remaining FROM public.instalments WHERE client_id = c.id AND paid_amount < amount ORDER BY due_date LIMIT 1) ni ON true
LEFT JOIN LATERAL (SELECT sum(amount - paid_amount) AS overdue FROM public.instalments WHERE client_id = c.id AND paid_amount < amount AND due_date < current_date) od ON true
LEFT JOIN LATERAL (SELECT sum(amount) AS late_fee_paid FROM public.payments WHERE client_id = c.id AND type = 'Late fee') lf ON true;

GRANT SELECT ON public.client_balances TO authenticated;
-- Reminder log + RPC for upcoming reminders

CREATE TABLE IF NOT EXISTS public.installment_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp','email','manual')),
  message       TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by       UUID,
  meta          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_inst_rem_sent_at ON public.installment_reminders (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_rem_inst    ON public.installment_reminders (installment_id);

ALTER TABLE public.installment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view reminders"   ON public.installment_reminders;
CREATE POLICY "Admins view reminders"   ON public.installment_reminders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage reminders" ON public.installment_reminders;
CREATE POLICY "Admins manage reminders" ON public.installment_reminders FOR ALL    TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- RPC: list installments needing a reminder (next due within N days, status active, not reminded today)
CREATE OR REPLACE FUNCTION public.admin_due_reminders(p_days INT DEFAULT 3)
RETURNS TABLE (
  installment_id    UUID,
  order_id          UUID,
  user_id           UUID,
  customer_name     TEXT,
  customer_email    TEXT,
  customer_phone    TEXT,
  total_amount      NUMERIC,
  paid_amount       NUMERIC,
  remaining_amount  NUMERIC,
  next_due_date     DATE,
  days_until_due    INT,
  reminded_today    BOOLEAN
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    i.id,
    i.order_id,
    i.user_id,
    coalesce(p.full_name, u.email) AS customer_name,
    u.email                        AS customer_email,
    p.phone                        AS customer_phone,
    i.total_amount,
    i.paid_amount,
    i.remaining_amount,
    i.next_due_date,
    (i.next_due_date - CURRENT_DATE)::int AS days_until_due,
    EXISTS (
      SELECT 1 FROM public.installment_reminders r
      WHERE r.installment_id = i.id
        AND r.sent_at::date = CURRENT_DATE
    ) AS reminded_today
  FROM public.installments i
  LEFT JOIN public.profiles p  ON p.id = i.user_id
  LEFT JOIN auth.users u       ON u.id = i.user_id
  WHERE i.status = 'active'
    AND i.next_due_date IS NOT NULL
    AND i.next_due_date <= (CURRENT_DATE + p_days)
    AND i.remaining_amount > 0
  ORDER BY i.next_due_date ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_due_reminders(INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_due_reminders(INT) TO authenticated;

-- RPC: log a sent reminder
CREATE OR REPLACE FUNCTION public.admin_log_reminder(
  p_installment_id UUID,
  p_channel        TEXT,
  p_message        TEXT DEFAULT NULL,
  p_meta           JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_user  UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admins only';
  END IF;
  SELECT user_id INTO v_user FROM public.installments WHERE id = p_installment_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'installment not found';
  END IF;
  INSERT INTO public.installment_reminders (installment_id, user_id, channel, message, sent_by, meta)
  VALUES (p_installment_id, v_user, p_channel, p_message, auth.uid(), coalesce(p_meta,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_log_reminder(UUID,TEXT,TEXT,JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_reminder(UUID,TEXT,TEXT,JSONB) TO authenticated;

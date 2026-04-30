-- =====================================================================
-- Vivygold Admin Dashboard Enhancements
-- - Adds base_currency to products (admin chooses NGN or USD per product)
-- - Adds default_due_days for installment scheduling
-- - Seeds Flutterwave keys + store info into settings
-- - Adds admin convenience views & helper functions for the dashboard
-- =====================================================================

-- 1) Per-product base currency
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'NGN'
  CHECK (base_currency IN ('NGN', 'USD'));

-- 2) Installment due-day default + first part due tracking
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS interval_days INT NOT NULL DEFAULT 30;

-- 3) Store key/value settings for Flutterwave + store branding
INSERT INTO public.settings (key, value)
VALUES
  ('flutterwave_keys', '{"public_key":"", "secret_key":"", "encryption_key":"", "webhook_hash":""}'::jsonb),
  ('store_info', '{"name":"Vivygold","email":"hello@vivygold.com","phone":"","whatsapp":"","address":"","instagram":"","tiktok":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4) Helper view: order summary for admin dashboard
CREATE OR REPLACE VIEW public.admin_order_summary AS
SELECT
  o.id,
  o.order_number,
  o.user_id,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.currency,
  o.subtotal,
  o.shipping_fee,
  o.total,
  o.status,
  o.payment_status,
  o.is_installment,
  o.created_at,
  COALESCE(i.paid_amount, CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END) AS amount_paid,
  COALESCE(i.remaining_amount, CASE WHEN o.payment_status = 'paid' THEN 0 ELSE o.total END) AS amount_remaining,
  i.total_parts AS installment_parts,
  i.status AS installment_status,
  i.next_due_date AS installment_next_due
FROM public.orders o
LEFT JOIN public.installments i ON i.order_id = o.id;

-- 5) Helper RPC: list all customers with summary stats (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  total_orders BIGINT,
  total_spent NUMERIC,
  total_paid NUMERIC,
  total_outstanding NUMERIC,
  active_installments BIGINT,
  completed_installments BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.email::TEXT,
    p.full_name,
    p.phone,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin,
    COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.user_id = u.id), 0) AS total_orders,
    COALESCE((SELECT SUM(total) FROM public.orders o WHERE o.user_id = u.id), 0) AS total_spent,
    COALESCE((SELECT SUM(paid_amount) FROM public.installments i WHERE i.user_id = u.id), 0)
      + COALESCE((SELECT SUM(total) FROM public.orders o WHERE o.user_id = u.id AND o.payment_status = 'paid' AND NOT o.is_installment), 0) AS total_paid,
    COALESCE((SELECT SUM(remaining_amount) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'active'), 0) AS total_outstanding,
    COALESCE((SELECT COUNT(*) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'active'), 0) AS active_installments,
    COALESCE((SELECT COUNT(*) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'completed'), 0) AS completed_installments
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY u.created_at DESC;
$$;

-- 6) Helper RPC: dashboard stats
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.has_role(auth.uid(), 'admin') THEN '{}'::jsonb
  ELSE jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_admins', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'),
    'total_products', (SELECT COUNT(*) FROM public.products),
    'active_products', (SELECT COUNT(*) FROM public.products WHERE active = true),
    'total_orders', (SELECT COUNT(*) FROM public.orders),
    'pending_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'pending'),
    'processing_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'processing'),
    'shipped_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'shipped'),
    'delivered_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'delivered'),
    'paid_orders', (SELECT COUNT(*) FROM public.orders WHERE payment_status = 'paid'),
    'partial_orders', (SELECT COUNT(*) FROM public.orders WHERE payment_status = 'partial'),
    'unpaid_orders', (SELECT COUNT(*) FROM public.orders WHERE payment_status = 'unpaid'),
    'revenue_ngn', (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE payment_status = 'paid' AND currency = 'NGN'),
    'revenue_usd', (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE payment_status = 'paid' AND currency = 'USD'),
    'partial_revenue_ngn', (SELECT COALESCE(SUM(paid_amount),0) FROM public.installments i JOIN public.orders o ON o.id = i.order_id WHERE o.currency = 'NGN'),
    'partial_revenue_usd', (SELECT COALESCE(SUM(paid_amount),0) FROM public.installments i JOIN public.orders o ON o.id = i.order_id WHERE o.currency = 'USD'),
    'outstanding_ngn', (SELECT COALESCE(SUM(remaining_amount),0) FROM public.installments i JOIN public.orders o ON o.id = i.order_id WHERE o.currency = 'NGN' AND i.status = 'active'),
    'outstanding_usd', (SELECT COALESCE(SUM(remaining_amount),0) FROM public.installments i JOIN public.orders o ON o.id = i.order_id WHERE o.currency = 'USD' AND i.status = 'active'),
    'active_installments', (SELECT COUNT(*) FROM public.installments WHERE status = 'active'),
    'completed_installments', (SELECT COUNT(*) FROM public.installments WHERE status = 'completed'),
    'defaulted_installments', (SELECT COUNT(*) FROM public.installments WHERE status = 'defaulted')
  ) END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- 7) Helper RPC: grant admin role by email (admin only)
CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE email = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found. Ask them to sign up first or use Add Admin (creates account).');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_role_by_email(TEXT) TO authenticated;

-- 8) Helper RPC: revoke admin role
CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id UUID)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Don't allow revoking yourself if you are the only admin
  IF _user_id = auth.uid() AND (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot remove the only remaining admin.');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_role(UUID) TO authenticated;

-- 9) Backfill: ensure all existing products have a sensible base_currency
UPDATE public.products SET base_currency = 'NGN' WHERE base_currency IS NULL;

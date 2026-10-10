-- =====================================================================
-- Fix admin_dashboard_stats:
-- Revenue   → only orders with payment_status = 'paid'
-- Installment paid → only installments with actual paid_amount > 0
-- Outstanding      → only active installments
-- Orders count     → only non-cancelled, non-failed orders
-- Customers        → unchanged (real count)
-- Products         → unchanged (real count)
-- Add pending_verification to the payment_status enum constraint (if any)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.has_role(auth.uid(), 'admin') THEN '{}'::jsonb
  ELSE jsonb_build_object(
    -- Users & catalog (always real)
    'total_users',       (SELECT COUNT(*) FROM auth.users),
    'total_admins',      (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'),
    'total_products',    (SELECT COUNT(*) FROM public.products),
    'active_products',   (SELECT COUNT(*) FROM public.products WHERE active = true),

    -- Orders (only count non-test, non-failed orders)
    'total_orders',      (SELECT COUNT(*) FROM public.orders WHERE payment_status NOT IN ('failed') AND status NOT IN ('cancelled')),
    'pending_orders',    (SELECT COUNT(*) FROM public.orders WHERE status = 'pending'   AND payment_status NOT IN ('failed')),
    'processing_orders', (SELECT COUNT(*) FROM public.orders WHERE status = 'processing' AND payment_status NOT IN ('failed')),
    'shipped_orders',    (SELECT COUNT(*) FROM public.orders WHERE status = 'shipped'),
    'delivered_orders',  (SELECT COUNT(*) FROM public.orders WHERE status = 'delivered'),
    'paid_orders',       (SELECT COUNT(*) FROM public.orders WHERE payment_status = 'paid'),
    'partial_orders',    (SELECT COUNT(*) FROM public.orders WHERE payment_status = 'partial'),
    'unpaid_orders',     (SELECT COUNT(*) FROM public.orders WHERE payment_status IN ('unpaid', 'pending_verification')),

    -- Revenue: only fully confirmed paid orders
    'revenue_ngn', (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE payment_status = 'paid' AND currency = 'NGN'),
    'revenue_usd', (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE payment_status = 'paid' AND currency = 'USD'),

    -- Installment revenue: only where payment has actually been made (paid_amount > 0)
    'partial_revenue_ngn', (
      SELECT COALESCE(SUM(i.paid_amount),0)
      FROM public.installments i
      JOIN public.orders o ON o.id = i.order_id
      WHERE o.currency = 'NGN' AND i.paid_amount > 0
    ),
    'partial_revenue_usd', (
      SELECT COALESCE(SUM(i.paid_amount),0)
      FROM public.installments i
      JOIN public.orders o ON o.id = i.order_id
      WHERE o.currency = 'USD' AND i.paid_amount > 0
    ),

    -- Outstanding: only active installments with actual remaining balance
    'outstanding_ngn', (
      SELECT COALESCE(SUM(i.remaining_amount),0)
      FROM public.installments i
      JOIN public.orders o ON o.id = i.order_id
      WHERE o.currency = 'NGN' AND i.status = 'active' AND i.paid_amount > 0
    ),
    'outstanding_usd', (
      SELECT COALESCE(SUM(i.remaining_amount),0)
      FROM public.installments i
      JOIN public.orders o ON o.id = i.order_id
      WHERE o.currency = 'USD' AND i.status = 'active' AND i.paid_amount > 0
    ),

    -- Installment plan counts: only real active plans (where first payment was made)
    'active_installments',    (
      SELECT COUNT(*) FROM public.installments i
      WHERE i.status = 'active' AND i.paid_amount > 0
    ),
    'completed_installments', (SELECT COUNT(*) FROM public.installments WHERE status = 'completed'),
    'defaulted_installments', (SELECT COUNT(*) FROM public.installments WHERE status = 'defaulted')
  ) END;
$$;

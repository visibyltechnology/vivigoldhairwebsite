-- =============================================================================
-- VIVYGOLD — Full Supabase schema (paste this into the SQL Editor and Run)
-- Project: iivgirvlatkcwklflmzc
-- =============================================================================
-- This file combines:
--   1) Original storefront schema (roles, products, orders, installments, etc.)
--   2) Tweak migration (set_updated_at search_path)
--   3) Admin dashboard enhancements (base_currency, settings, RPCs, views)
-- It is idempotent-safe: most CREATEs use IF NOT EXISTS or guard with DO blocks.
-- =============================================================================

-- =============================================================================
-- PART 1 — Core schema
-- =============================================================================

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'customer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;
CREATE POLICY "Public view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view categories" ON public.categories;
CREATE POLICY "Public view categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT,
  hair_type TEXT,
  length_inches INT,
  price_ngn NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_price_ngn NUMERIC(12,2),
  compare_price_usd NUMERIC(12,2),
  stock INT NOT NULL DEFAULT 0,
  images TEXT[] NOT NULL DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS products_set_updated ON public.products;
CREATE TRIGGER products_set_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP POLICY IF EXISTS "Public view active products" ON public.products;
CREATE POLICY "Public view active products" ON public.products FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "Admins view all products" ON public.products;
CREATE POLICY "Admins view all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view reviews" ON public.reviews;
CREATE POLICY "Public view reviews" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users add own reviews" ON public.reviews;
CREATE POLICY "Users add own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own reviews" ON public.reviews;
CREATE POLICY "Users update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own reviews" ON public.reviews;
CREATE POLICY "Users delete own reviews" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist;
CREATE POLICY "Users manage own wishlist" ON public.wishlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cart" ON public.carts;
CREATE POLICY "Users manage own cart" ON public.carts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own cart items" ON public.cart_items;
CREATE POLICY "Users view own cart items" ON public.cart_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own cart items" ON public.cart_items;
CREATE POLICY "Users insert own cart items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users update own cart items" ON public.cart_items;
CREATE POLICY "Users update own cart items" ON public.cart_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users delete own cart items" ON public.cart_items;
CREATE POLICY "Users delete own cart items" ON public.cart_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('pending','processing','shipped','delivered','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid','refunded','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.order_currency AS ENUM ('NGN','USD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('VG-' || to_char(now(),'YYMMDD') || '-' || substr(md5(random()::text),1,6)),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency order_currency NOT NULL DEFAULT 'NGN',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  is_installment BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS orders_set_updated ON public.orders;
CREATE TRIGGER orders_set_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;
CREATE POLICY "Users insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins view all order items" ON public.order_items;
CREATE POLICY "Admins view all order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DO $$ BEGIN CREATE TYPE public.installment_status AS ENUM ('active','completed','defaulted','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_parts INT NOT NULL CHECK (total_parts BETWEEN 2 AND 4),
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) NOT NULL,
  next_due_date DATE,
  status installment_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS installments_set_updated ON public.installments;
CREATE TRIGGER installments_set_updated BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP POLICY IF EXISTS "Users view own installments" ON public.installments;
CREATE POLICY "Users view own installments" ON public.installments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own installments" ON public.installments;
CREATE POLICY "Users create own installments" ON public.installments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all installments" ON public.installments;
CREATE POLICY "Admins view all installments" ON public.installments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage installments" ON public.installments;
CREATE POLICY "Admins manage installments" ON public.installments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID REFERENCES public.installments(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  part_number INT NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  flutterwave_tx_ref TEXT,
  flutterwave_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own inst payments" ON public.installment_payments;
CREATE POLICY "Users view own inst payments" ON public.installment_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.installments i WHERE i.id = installment_id AND i.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins view all inst payments" ON public.installment_payments;
CREATE POLICY "Admins view all inst payments" ON public.installment_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage inst payments" ON public.installment_payments;
CREATE POLICY "Admins manage inst payments" ON public.installment_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_label TEXT,
  cta_url TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view active banners" ON public.banners;
CREATE POLICY "Public view active banners" ON public.banners FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view settings" ON public.settings;
CREATE POLICY "Public view settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage settings" ON public.settings;
CREATE POLICY "Admins manage settings" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.settings (key,value) VALUES
  ('exchange_rate', '{"usd_to_ngn": 1650, "default_currency": "NGN"}'::jsonb),
  ('shipping', '{"flat_ngn": 5000, "flat_usd": 15}'::jsonb),
  ('store', '{"name":"Vivygold","tagline":"Exceptional Store"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.categories (name, slug, description, sort_order) VALUES
  ('Wigs','wigs','Premium luxury wigs',1),
  ('Bundles','bundles','Raw hair bundles',2),
  ('Closures','closures','Lace closures',3),
  ('Frontals','frontals','HD lace frontals',4),
  ('Braids','braids','Pre-stretched braiding hair',5)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- PART 2 — Admin dashboard enhancements
-- =============================================================================

-- Per-product base currency
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'NGN'
  CHECK (base_currency IN ('NGN', 'USD'));

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS interval_days INT NOT NULL DEFAULT 30;

INSERT INTO public.settings (key, value)
VALUES
  ('flutterwave_keys', '{"public_key":"", "secret_key":"", "encryption_key":"", "webhook_hash":""}'::jsonb),
  ('store_info', '{"name":"Vivygold","email":"hello@vivygold.com","phone":"","whatsapp":"","address":"","instagram":"","tiktok":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

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
    u.id,
    u.email::TEXT,
    p.full_name,
    p.phone,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'),
    COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.user_id = u.id), 0),
    COALESCE((SELECT SUM(total) FROM public.orders o WHERE o.user_id = u.id), 0),
    COALESCE((SELECT SUM(paid_amount) FROM public.installments i WHERE i.user_id = u.id), 0)
      + COALESCE((SELECT SUM(total) FROM public.orders o WHERE o.user_id = u.id AND o.payment_status = 'paid' AND NOT o.is_installment), 0),
    COALESCE((SELECT SUM(remaining_amount) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'active'), 0),
    COALESCE((SELECT COUNT(*) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'active'), 0),
    COALESCE((SELECT COUNT(*) FROM public.installments i WHERE i.user_id = u.id AND i.status = 'completed'), 0)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY u.created_at DESC;
$$;

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

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id UUID)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id = auth.uid() AND (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot remove the only remaining admin.');
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_role(UUID) TO authenticated;

UPDATE public.products SET base_currency = 'NGN' WHERE base_currency IS NULL;

-- =============================================================================
-- DONE. Next steps:
--   1) Sign up an account via the app at /auth.
--   2) Get your user id from auth.users:
--        SELECT id, email FROM auth.users;
--   3) Promote yourself to admin:
--        INSERT INTO public.user_roles (user_id, role) VALUES ('<your-user-id>', 'admin');
--   4) Visit /admin and use Settings → Flutterwave to paste your live keys.
-- =============================================================================
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


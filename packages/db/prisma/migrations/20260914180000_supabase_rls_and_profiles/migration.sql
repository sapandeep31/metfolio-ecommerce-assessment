-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer' CHECK ("role" IN ('customer', 'admin')),
    "display_name" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE
);

-- Index for role lookups and RLS evaluation performance
CREATE INDEX IF NOT EXISTS "profiles_role_idx" ON "profiles" ("role");
CREATE INDEX IF NOT EXISTS "profiles_email_idx" ON "profiles" ("email");

-- User sync trigger from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_app_meta_data->>'role', new.raw_user_meta_data->>'role', 'customer'),
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    updated_at = CURRENT_TIMESTAMP;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer helper to check admin status safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

-- Allow orders.user_id to store Supabase Auth UUID strings without constraint error
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_fkey";
CREATE INDEX IF NOT EXISTS "orders_user_id_text_idx" ON "orders" ("user_id");

-- Ensure RLS is enabled on all tables
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON "profiles";
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON "profiles";
CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id 
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "profiles_admin_all" ON "profiles";
CREATE POLICY "profiles_admin_all" ON "profiles"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_active_anon" ON "products";
CREATE POLICY "products_select_active_anon" ON "products"
  FOR SELECT
  TO anon
  USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "products_select_active_authenticated" ON "products";
CREATE POLICY "products_select_active_authenticated" ON "products"
  FOR SELECT
  TO authenticated
  USING (status = 'ACTIVE' OR public.is_admin());

DROP POLICY IF EXISTS "products_admin_all" ON "products";
CREATE POLICY "products_admin_all" ON "products"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_all" ON "categories";
CREATE POLICY "categories_select_all" ON "categories"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_admin_all" ON "categories";
CREATE POLICY "categories_admin_all" ON "categories"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PRODUCT VARIANTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_variants_select_active_anon" ON "product_variants";
CREATE POLICY "product_variants_select_active_anon" ON "product_variants"
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "product_variants_select_active_authenticated" ON "product_variants";
CREATE POLICY "product_variants_select_active_authenticated" ON "product_variants"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.status = 'ACTIVE'
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS "product_variants_admin_all" ON "product_variants";
CREATE POLICY "product_variants_admin_all" ON "product_variants"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PRODUCT IMAGES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_images_select_all" ON "product_images";
CREATE POLICY "product_images_select_all" ON "product_images"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_images_admin_all" ON "product_images";
CREATE POLICY "product_images_admin_all" ON "product_images"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- ORDERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_own" ON "orders";
CREATE POLICY "orders_select_own" ON "orders"
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text OR public.is_admin());

DROP POLICY IF EXISTS "orders_admin_all" ON "orders";
CREATE POLICY "orders_admin_all" ON "orders"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- ORDER ITEMS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "order_items_select_own" ON "order_items";
CREATE POLICY "order_items_select_own" ON "order_items"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = (SELECT auth.uid())::text OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "order_items_admin_all" ON "order_items";
CREATE POLICY "order_items_admin_all" ON "order_items"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- STOCK LEDGER POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "stock_ledger_admin_all" ON "stock_ledger";
CREATE POLICY "stock_ledger_admin_all" ON "stock_ledger"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select_own" ON "payments";
CREATE POLICY "payments_select_own" ON "payments"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND (o.user_id = (SELECT auth.uid())::text OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "payments_admin_all" ON "payments";
CREATE POLICY "payments_admin_all" ON "payments"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- WEBHOOK EVENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "webhook_events_admin_all" ON "webhook_events";
CREATE POLICY "webhook_events_admin_all" ON "webhook_events"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- USERS (LEGACY) POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_admin_all" ON "users";
CREATE POLICY "users_admin_all" ON "users"
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

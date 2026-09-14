CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "actor_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_status_history_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "order_status_history_order_id_created_at_idx"
  ON "order_status_history"("order_id", "created_at");

CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "order_status_history" ("id", "order_id", "from_status", "to_status", "reason", "created_at")
  VALUES (
    'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    NEW."id",
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."status" END,
    NEW."status",
    CASE WHEN TG_OP = 'INSERT' THEN 'order-created' ELSE 'status-transition' END,
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_history_insert_trigger ON "orders";
CREATE TRIGGER orders_status_history_insert_trigger
  AFTER INSERT ON "orders"
  FOR EACH ROW
  EXECUTE FUNCTION public.record_order_status_change();

DROP TRIGGER IF EXISTS orders_status_history_update_trigger ON "orders";
CREATE TRIGGER orders_status_history_update_trigger
  AFTER UPDATE OF "status" ON "orders"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION public.record_order_status_change();

ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_history_select_own" ON "order_status_history"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.user_id = (SELECT auth.uid())::text OR public.is_admin())
    )
  );

CREATE POLICY "order_status_history_admin_all" ON "order_status_history"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
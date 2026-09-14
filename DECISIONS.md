# Technical Decisions & Architecture: Order Management System

This document outlines the architectural decisions, concurrency controls, security postures, and production tradeoffs implemented for the Metfolio Order Management System (OMS).

---

## 1. Concurrency & Stock Reservation Architecture

E-commerce flash sales and simultaneous multi-user checkouts present two critical failure modes: **double-selling (overselling)** and **multi-row database deadlocks**.

### 1.1 Atomic Reservation & Engine-Level Safety

Rather than relying solely on application-level locks (`SELECT ... FOR UPDATE` which can be bypassed by uncoordinated processes or admin queries), we enforce concurrency controls directly at the PostgreSQL engine level:

1. **Guarded Conditional Decrement:**
   ```sql
   UPDATE "product_variants"
      SET "stock_reserved" = "stock_reserved" + $quantity,
          "updated_at" = NOW()
    WHERE "id" = $variantId
      AND ("stock_on_hand" - "stock_reserved") >= $quantity
   ```
   If stock is insufficient, the row count is `0`. The transaction immediately aborts without acquiring subsequent locks.
2. **Database CHECK Constraints as Invariant Backstops:**
   ```sql
   CONSTRAINT "variant_stock_non_negative"
     CHECK ("stock_on_hand" >= "stock_reserved" AND "stock_reserved" >= 0)
   ```
   Even if an application code regression attempts an unverified decrement, PostgreSQL rejects the transaction with error code `23514` (`check_violation`), physically preventing negative availability.
3. **Audit Ledger Synchronization:**
   Every stock change records a row in `stock_ledger` (`RESERVE`, `RELEASE`, `FULFILL`, `RESTOCK`, `ADJUST`) detailing the variant, order, quantity delta, and reason.

### 1.2 Deadlock Elimination via Lexicographical Lock Ordering

When two shoppers simultaneously order complementary items in reverse sequence (e.g., Cart A orders `[V1, V2]` while Cart B orders `[V2, V1]`), traditional row-locking deadlocks. We eliminate this by sorting all variant IDs lexicographically via `InventoryService.orderLines()` before any lock acquisition:

```typescript
static orderLines<T extends { variantId: string }>(lines: readonly T[]): T[] {
  return [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
}
```

Because both transactions acquire locks in identical global order, cyclic wait conditions are mathematically impossible.

### 1.3 Two-Tier Reservation Expiration Sweeper

Abandoned carts hold reservations for a 15-minute TTL. To guarantee release without depending solely on an application container's health:

- **Primary (In-Database `pg_cron`):** PostgreSQL runs `sweep_expired_reservations()` every minute directly within the database engine, releasing expired holds and restoring availability.
- **Secondary (NestJS Worker):** A backup periodic sweeper runs in the API container with timeout guards and structured failure logging.

---

## 2. Webhook Idempotency & Lifecycle State Machine

Payment providers guarantee at-least-once delivery, which guarantees duplicate, replayed, and out-of-order events.

```
       ┌──────────┐      Checkout      ┌───────────┐      Paid Webhook      ┌───────────┐
       │ PENDING  │ ─────────────────> │   PAID    │ ─────────────────────> │ FULFILLED │
       └──────────┘                    └───────────┘                        └───────────┘
         │      │                            │
  Cancel │      │ Expire                     │ Refund
         v      v                            v
   ┌───────────────┐                  ┌───────────┐
   │ CANCELLED /   │                  │ REFUNDED  │
   │   EXPIRED     │                  └───────────┘
   └───────────────┘
```

### 2.1 Three-Layer Defense Against Duplicate & Replayed Webhooks

1. **Layer 1 — Atomic Primary Key Ingest:**
   Ingest is an `INSERT ... ON CONFLICT ("provider", "event_id") DO NOTHING` into `webhook_events` within the processing database transaction. If an event ID already exists, zero rows are inserted and the webhook returns an immediate 200 acknowledgment without side effects.
2. **Layer 2 — Guarded Atomic State Transitions:**
   State mutations are bound to expected predecessors:
   ```sql
   UPDATE "orders"
      SET "status" = 'PAID'::"OrderStatus", "paid_at" = NOW()
    WHERE "id" = $orderId AND "status" = 'PENDING'::"OrderStatus"
   ```
   If a duplicate slips past Layer 1 or concurrent webhooks race, only one update returns row count `1`. The fulfillment logic executes exclusively if the transition was claimed.
3. **Layer 3 — Terminal State Detection (`isTerminalOrderStatus`):**
   `FULFILLED`, `CANCELLED`, `EXPIRED`, and `REFUNDED` are terminal. Out-of-order events (e.g. `payment_intent.succeeded` arriving after `order.cancelled` or `checkout.session.expired`) are safely acknowledged and discarded.

### 2.2 End-to-End Refund Flow & Restocking

- **Admin-Triggered Refund:** An administrator triggers `POST /admin/orders/:id/refund`. The API calls Stripe's API:
  ```typescript
  stripe.refunds.create(
    { payment_intent: paymentIntentId, reason: 'requested_by_customer' },
    { idempotencyKey: `refund:${orderId}:${paymentIntentId}` },
  );
  ```
  Upon Stripe confirmation, the order transitions `PAID -> REFUNDED`, the payment status updates to `REFUNDED`, and items are restored to inventory with an audit entry in `stock_ledger` (`kind: 'RESTOCK'`, `reason: 'order-refund'`).
- **Webhook Synchronization:** When Stripe emits `charge.refunded`, the webhook checks the order status. If already refunded by the admin action, it idempotently acknowledges. If initiated directly in the Stripe Dashboard, it executes the transition and restores inventory.

---

## 3. Row-Level Security (RLS) Architecture & Edge Cases

PostgreSQL Row-Level Security (RLS) is enabled on all 11 tables (`products`, `categories`, `product_variants`, `product_images`, `orders`, `order_items`, `stock_ledger`, `payments`, `profiles`, `webhook_events`, `users`), providing defense-in-depth even if application authorization logic fails.

### 3.1 Role Hierarchy & Permissions

- **`anon` (Unauthenticated):**
  - Read-only access to `products` where `status = 'ACTIVE'` and their associated variants, categories, and images.
  - Zero read/write access to orders, stock ledger, or admin data.
- **`customer` (Authenticated):**
  - Read-only access to their own orders (`user_id = auth.uid()::text`).
  - Read-only access to their own `order_items` via order ownership cascade.
  - Read/write access to their own `profiles` row (excluding role elevation).
  - No access to `stock_ledger`, `webhook_events`, or other customers' orders.
- **`admin`:**
  - Full SELECT, INSERT, UPDATE, DELETE across all tables.

### 3.2 Key RLS Policy Challenges & Solutions

1. **`public.is_admin()` Privilege Escalation Mitigation:**
   To evaluate admin status without granting customers SELECT permissions on the admin role column, we use a `SECURITY DEFINER` function:
   ```sql
   CREATE OR REPLACE FUNCTION public.is_admin()
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = ''
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND role = 'admin'
     );
   $$;
   ```
   _Crucial Security Detail:_ Setting `search_path = ''` prevents search path hijacking attacks, where a malicious user creates a deceptive `profiles` table in a customized schema.
2. **Order Items Ownership Propagation:**
   `order_items` does not store `user_id` directly. Customer read access requires joining back to `orders`:
   ```sql
   CREATE POLICY "customer_select_own_order_items" ON public.order_items
   FOR SELECT TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM public.orders
       WHERE orders.id = order_items.order_id
         AND orders.user_id = (SELECT auth.uid())::text
     )
   );
   ```
   An index on `order_items(order_id)` ensures this join runs as an index nested-loop with negligible overhead.

---

## 4. Production Hardening & Beyond-the-Brief Engineering

To make this system genuinely production-ready, we implemented several features beyond the basic assessment brief:

| Capability           | Assessment Brief       | Our Implementation                                                                 | Benefit                                                                                                           |
| :------------------- | :--------------------- | :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Rate Limiting**    | Optional / unspecified | Distributed Redis rate-limiting via `@nest-lab/throttler-storage-redis`            | Protects checkout & auth endpoints across autoscaled multi-instance deployments                                   |
| **Secret Scanning**  | Not mentioned          | Pre-commit hook + `.gitleaks.toml` configuration                                   | Prevents API keys, Supabase credentials, or Stripe keys from ever entering Git history                            |
| **Payment Seam**     | Stripe direct call     | `PaymentGateway` driver interface with `createStripeGateway` & `createMockGateway` | Full deterministic E2E/CI testing of race conditions, retries, and failures offline without third-party flakiness |
| **Auth Integration** | Basic Auth             | `@supabase/ssr` with HttpOnly cookies & Next.js edge middleware route guards       | Full SSR session hydration, CSRF immunity, and zero client-side token exposure                                    |
| **Data Integrity**   | App-level checks       | DB CHECK constraints + Stock Audit Ledger                                          | Guaranteed physical impossibility of overselling                                                                  |

---

## 5. Vulnerability Mitigations & Security Audit

1. **Timing Attack Immunity on Webhook Signatures:**
   Signatures are validated using constant-time string comparisons (`crypto.timingSafeEqual`) on the raw unparsed request buffer before JSON deserialization.
2. **Server-Authoritative Pricing (No Client Tampering):**
   Checkout line items and totals are strictly queried from the database. Client requests pass only variant IDs and quantities; prices, tax calculations, and currency amounts are generated server-side.
3. **Integer Cents Accounting:**
   All monetary amounts are stored and calculated as integer cents (`totalCents`, `unitPriceCents`), avoiding IEEE 754 floating-point rounding inaccuracies.
4. **Dependency Auditing:**
   Dependencies were audited via `pnpm audit`. High-risk network paths are protected behind strict Zod validation pipes and helmet security headers.

---

## 6. Tradeoffs & Evolution

### 6.1 What Was Cut for Time and Why

Given the timebox of this technical assessment, we prioritized data integrity, concurrency safety, and payment correctness over non-critical secondary features:

1. **Partial Line-Item Refunds:**
   _Why cut:_ A customer requesting a refund for 1 item out of 3 requires granular tax, shipping recalculations, and fractional payment gateway intent captures. We implemented full order refunds with complete atomic inventory restocking and audit ledger synchronization, satisfying the payment correctness requirement without unnecessary accounting complexity.
2. **Asynchronous Webhook Queue (BullMQ / AWS SQS):**
   _Why cut:_ Synchronous in-transaction webhook ingestion with `INSERT ... ON CONFLICT DO NOTHING` and guarded state transitions already guarantees zero double-processing or race conditions. A durable message queue adds operational infrastructure overhead (workers, DLQs, broker monitoring) without altering the idempotency guarantee for the assessment scale.
3. **Multi-Currency & Dynamic Tax Calculation:**
   _Why cut:_ Explicitly listed as "not required" by the brief. All calculations use fixed integer basis points (`TAX_BASIS_POINTS`) in minor units (cents) to guarantee zero IEEE 754 floating-point inaccuracies.
4. **Email Dispatch Reliability Worker:**
   _Why cut:_ Confirmation emails fire post-transaction commit. In production, this would use a background retry queue so an unreachable SMTP server does not drop notifications.

---

### 6.2 What We Would Do Differently with Another Week

With an additional week to iterate on this system:

1. **Embedded Stripe Payment Elements:**
   Replace the hosted Stripe Checkout redirect with embedded Payment Elements, supporting Apple Pay, Google Pay, and seamless 3D Secure 2 authentication directly within the storefront.
2. **Distributed Queue Worker Pipeline:**
   Decouple long-running notifications and external syncs from the webhook path using BullMQ on our Redis cluster, with dedicated dead-letter queues (DLQ) and Prometheus alerting.
3. **PgBouncer Transaction Pooling & Read Replicas:**
   Configure connection pooling via Supabase PgBouncer for burst traffic, and split read-only catalog browsing from transactional checkout writes.
4. **Automated End-to-End Synthetic Monitoring:**
   Deploy a headless cron job placing canary test-mode orders every hour to continuously verify gateway connectivity, webhook delivery latencies, and inventory ledger balance.

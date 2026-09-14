# Metfolio Atelier — High-Concurrency E-Commerce Platform

A production-grade luxury jewelry e-commerce platform engineered around two fundamental concurrency guarantees:

1. **Zero Oversell Invariant**: 20 customers can race for the last 3 units simultaneously; exactly 3 succeed, and 17 receive clean, non-corrupting conflict responses. Overselling is structurally impossible by construction.
2. **100% Idempotent Payment Processing**: A payment webhook delivered 20 times concurrently results in the order being charged, fulfilled, and recorded in the audit ledger **exactly once**.

---

### Live Deployments & Test Credentials

- **Storefront & Admin Console (Vercel):** [https://metfolio-ecommerce-assessment.vercel.app](https://metfolio-ecommerce-assessment.vercel.app)
- **Backend API & Concurrency Engine (Render):** [https://metfolio-oms-api.onrender.com](https://metfolio-oms-api.onrender.com)
- **Health Endpoint:** [https://metfolio-oms-api.onrender.com/health](https://metfolio-oms-api.onrender.com/health)

| Role         | Email                 | Password      | Access & Permissions                                                             |
| :----------- | :-------------------- | :------------ | :------------------------------------------------------------------------------- |
| **Admin**    | `admin@shop.local`    | `password123` | Full access to `/admin`: catalog CRUD, inventory adjustments, and order refunds  |
| **Customer** | `customer@shop.local` | `password123` | Storefront browsing, persistent cart sync, checkout, and `/orders` order history |

---

## System Architecture

```mermaid
flowchart LR
    Browser[Client Browser] -->|Server Actions / Pages| Web[apps/web<br/>Next.js 14 App Router]
    Web -->|HS256 Service Token| API[apps/api<br/>NestJS 10 Engine]
    Gateway[Stripe / Mock Gateway] -->|Signed Webhook| API
    Web -->|Redirect to Pay| Gateway

    API --> DB[(PostgreSQL<br/>CHECK Invariants & Stock Ledger)]
    API --> Redis[(Redis<br/>Cart Sessions & Rate Limits)]
    API --> SMTP[Email Notifications]
```

- **`apps/web` (Next.js 14)**: Editorial storefront with Incremental Static Regeneration (ISR), scrollytelling animations, and dedicated low-latency Admin Console.
- **`apps/api` (NestJS 10)**: Order management system, reservation lifecycle, lexicographically sorted row-level locks, and webhook idempotency engine.
- **`packages/db` (Prisma + PostgreSQL)**: Database schema, append-only immutable stock ledger, and PostgreSQL CHECK constraints.
- **`packages/shared` (Zod + Domain Logic)**: Shared Zod contracts, strict integer-cent pricing math, and pure stock predicate calculations.

---

## The Core Concurrency & Idempotency Guarantees

### 1. Inventory Consistency Under Concurrency

- **Database-Level CHECK Constraints**: `CHECK ("stock_on_hand" >= 0 AND "stock_reserved" >= 0 AND "stock_reserved" <= "stock_on_hand")`. No application-level bug or race condition can ever commit a negative or oversold state.
- **Atomic Conditional Updates**: `UPDATE "product_variants" SET "stock_reserved" = "stock_reserved" + $qty WHERE "id" = $id AND "stock_on_hand" - "stock_reserved" >= $qty`. Eliminates the read-modify-write race window.
- **Deadlock-Free Locking**: Variant IDs are always acquired in deterministic sorted order.
- **Append-Only Stock Ledger**: Every movement (`RESERVE`, `RELEASE`, `FULFILL`, `RESTOCK`, `ADJUST`) is logged with signed deltas. Replaying the ledger from zero reconstructs the exact inventory count.
- **Self-Cleaning Reservations**: Unpaid cart reservations expire automatically after 15 minutes, reclaimed by lazy checks on checkout and background database sweeps.

### 2. Idempotent Payment Webhooks

- **Primary Key Ingestion Guard**: Webhooks insert into an events table via `INSERT ... ON CONFLICT (provider, event_id) DO NOTHING`. Concurrent replays insert 0 rows and return HTTP 200 immediately.
- **Atomic State Transitions**: Transitions orders from `PENDING` to `PAID` using atomic conditional SQL in the same transaction that fulfills inventory.
- **Pluggable Payment Engine**: Supports live Stripe integration (`PAYMENTS_DRIVER=stripe`) as well as an offline, zero-dependency HMAC-signed mock gateway (`PAYMENTS_DRIVER=mock`) for automated CI testing.

---

## Quickstart & Local Setup

### Prerequisites

- **Node.js**: `v20.x` or higher
- **Package Manager**: `pnpm` (v9+)
- **Docker**: Docker Desktop or Docker Engine (for local PostgreSQL, Redis, and Mailhog)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/bastian-red/ecommerce.git
cd ecommerce
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and generate a secure `AUTH_SECRET`:

```bash
cp .env.example .env

# Generate a 32-character random secret for session & service tokens:
sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" .env
```

### 3. Launch Local Infrastructure Containers

Start local PostgreSQL (port `5433`), Redis (port `6380`), and Mailhog (SMTP `1026`, Web UI `8026`):

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Migrate & Seed Database

Generate the Prisma client, apply database migrations, and seed the luxury jewelry catalog:

```bash
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

### 5. Seed Admin & Customer Accounts

Create or sync the default Admin (`admin@shop.local`) and Customer (`customer@shop.local`) profiles:

```bash
pnpm db:seed:admin
```

### 6. Start the Development Servers

```bash
pnpm dev
```

- **Storefront & Admin:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000](http://localhost:4000)
- **API Health Check:** [http://localhost:4000/health](http://localhost:4000/health)
- **Mailhog Web UI:** [http://localhost:8026](http://localhost:8026)

---

## Seeding an Admin User

The platform includes a dedicated idempotent seed script for setting up user accounts and roles.

### Run the Admin Seeding Script

```bash
pnpm db:seed:admin
```

### What this script does:

1. **Creates / Updates Users in Auth & Database**:
   - **Admin User**: `admin@shop.local` / `password123` (Role: `ADMIN`)
   - **Customer User**: `customer@shop.local` / `password123` (Role: `CUSTOMER`)
2. **Assigns Application Metadata**: Configures the appropriate role flags (`app_metadata.role = 'admin'`) so that Admin routes (`/admin`) and privileged server actions are unlocked.
3. **Synchronizes User Profiles**: Upserts corresponding records into the public `users` table.

> [!TIP]
> **Admin Stock Management: `RESTOCK` vs. `ADJUST`**
> In the Admin Console (`/admin/inventory`), you will see two stock actions:
>
> - **Restock (`RESTOCK`)**: Used when new inventory arrives from suppliers. Takes a strictly positive quantity (`+delta`) and logs an inbound receipt to the stock ledger.
> - **Adjust (`ADJUST`)**: Used for cycle recounts, physical audits, or shrinkage/damage. Takes a signed quantity (`+delta` or `-delta`). Protected by database constraints so that stock cannot be adjusted below the quantity currently reserved by active customer checkouts.

---

## Stripe CLI Webhook Forwarder (Local Testing)

To test end-to-end checkout, payment confirmations, and refunds locally using real Stripe test credentials:

### 1. Install & Authenticate Stripe CLI

```bash
# macOS via Homebrew
brew install stripe/stripe-cli/stripe

# Authenticate with your Stripe account
stripe login
```

### 2. Start Forwarding Webhooks to Local API

Forward inbound Stripe events to the NestJS API webhook endpoint:

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

### 3. Configure Signing Secret in `.env`

When `stripe listen` starts, it will output a webhook signing secret:

```text
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Update your `.env` file with this secret and switch the payment driver:

```env
PAYMENTS_DRIVER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart your development server (`pnpm dev`) for the new environment variables to take effect.

### 4. Trigger Test Webhook Events

In another terminal, simulate payment events directly:

```bash
# Simulate successful checkout session
stripe trigger checkout.session.completed

# Simulate successful payment intent
stripe trigger payment_intent.succeeded

# Simulate order refund
stripe trigger charge.refunded
```

> [!NOTE]
> **Offline Mock Mode**: When developing without a Stripe account or internet connection, set `PAYMENTS_DRIVER=mock` in `.env`. The mock driver handles simulated checkouts and signs webhooks using standard HMAC-SHA256 signatures with zero external dependencies.

---

## Environment Variables Reference

| Variable                   | Default / Example                                          | Purpose                                                         |
| :------------------------- | :--------------------------------------------------------- | :-------------------------------------------------------------- |
| `NODE_ENV`                 | `development`                                              | Runtime environment (`development`, `production`, `test`).      |
| `DATABASE_URL`             | `postgresql://shop:shop@localhost:5433/shop?schema=public` | PostgreSQL connection string (pooled or direct).                |
| `DIRECT_DATABASE_URL`      | `postgresql://shop:shop@localhost:5433/shop?schema=public` | Direct PostgreSQL connection for Prisma schema migrations.      |
| `REDIS_URL`                | `redis://localhost:6380`                                   | Redis instance for active carts, rate limits, and caching.      |
| `API_PORT`                 | `4000`                                                     | Port for the NestJS backend API.                                |
| `API_BASE_URL`             | `http://localhost:4000`                                    | Internal server-to-server API URL.                              |
| `WEB_PORT`                 | `3000`                                                     | Port for the Next.js storefront.                                |
| `APP_BASE_URL`             | `http://localhost:3000`                                    | Public base URL of the web application.                         |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000`                                    | Client-accessible URL for the API backend.                      |
| `AUTH_SECRET`              | `openssl rand -base64 32`                                  | Secret used to sign Auth.js session cookies and service tokens. |
| `AUTH_URL`                 | `http://localhost:3000`                                    | Canonical Auth URL for authentication redirects.                |
| `PAYMENTS_DRIVER`          | `mock`                                                     | Active payment provider: `stripe` or `mock`.                    |
| `STRIPE_SECRET_KEY`        | `sk_test_...`                                              | Stripe secret API key (required if `PAYMENTS_DRIVER=stripe`).   |
| `STRIPE_WEBHOOK_SECRET`    | `whsec_...`                                                | Stripe webhook signing secret from Stripe Dashboard or CLI.     |
| `MOCK_WEBHOOK_SECRET`      | `mock-webhook-secret-at-least-32-chars`                    | HMAC secret used when `PAYMENTS_DRIVER=mock`.                   |
| `CURRENCY`                 | `usd`                                                      | Default transaction currency (minor-unit cents).                |
| `STORAGE_DRIVER`           | `local`                                                    | Media storage provider: `local` or `s3`.                        |
| `STORAGE_LOCAL_DIR`        | `./var/uploads`                                            | Filesystem path where uploaded media is stored in local mode.   |
| `STORAGE_PUBLIC_URL`       | `http://localhost:4000/media`                              | Base URL used by clients to fetch uploaded media.               |
| `SMTP_HOST`                | `localhost`                                                | SMTP server host (`localhost` for Mailhog).                     |
| `SMTP_PORT`                | `1026`                                                     | SMTP server port (`1026` for Mailhog).                          |
| `MAIL_FROM`                | `orders@shop.local`                                        | Default sender address for customer transactional emails.       |
| `RESERVATION_TTL_MINUTES`  | `15`                                                       | Stock hold expiration time for uncompleted checkouts.           |
| `TAX_BASIS_POINTS`         | `875`                                                      | Applied tax percentage in basis points (875 = 8.75%).           |
| `RATE_LIMIT_CHECKOUT`      | `30`                                                       | Maximum checkout attempts per client IP per minute.             |

---

## Testing & Quality Gates

The repository enforces strict verification across unit, integration, accessibility, and end-to-end suites:

```bash
# 1. Typecheck and Linting
pnpm lint
pnpm typecheck

# 2. Fast Unit Tests (Pricing math, contracts, ledger deltas, WCAG contrast)
pnpm test

# 3. Environment Variable Contract Validation
node scripts/env-contract.mjs

# 4. Concurrency & Webhook Idempotency Integration Tests (Requires Postgres + Redis)
./scripts/integration.sh

# 5. End-to-End Test Suite (Playwright)
./scripts/e2e.sh
```

---

## License

Private repository — Metfolio Technical Assessment.

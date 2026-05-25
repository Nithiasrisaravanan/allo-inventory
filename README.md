# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation platform with race-condition-safe stock management across multiple warehouses.

**Live demo:** `https://your-app.vercel.app` ← replace after deploy

---

## What I built

- **Product listing** — 6 products across 3 warehouses, with live available-stock counts
- **Reservation flow** — warehouse + quantity selection, 10-minute hold
- **Checkout page** — live countdown timer, confirm / cancel, auto-refresh on expiry
- **Concurrency-safe API** — Redis distributed lock + Postgres `SELECT FOR UPDATE` (two independent layers)
- **Automatic expiry** — lazy cleanup on reads + Vercel Cron every 60 seconds
- **Idempotency** — `Idempotency-Key` header on `POST /reservations` and `POST /reservations/:id/confirm`

---

## Running locally

### 1. Prerequisites

- Node.js 18+
- A hosted Postgres database (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash free tier works perfectly)

### 2. Clone and install

```bash
git clone https://github.com/your-username/allo-inventory
cd allo-inventory
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
REDIS_URL="redis://default:PASSWORD@HOST:PORT"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
CRON_SECRET="any-random-string"
```

### 4. Run migrations and seed

```bash
# Push schema to database
npm run db:push

# Seed with products, warehouses, and stock levels
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add NEXT_PUBLIC_BASE_URL   # your https://xxx.vercel.app URL
vercel env add CRON_SECRET

# Run seed on production
npx prisma db push
DATABASE_URL="..." npm run db:seed
```

The `vercel.json` in this repo configures a cron job to hit `/api/cron/release-expired` every minute automatically.

---

## How the concurrency guarantee works

This is the core of the exercise. Two requests arriving simultaneously for the last unit of a SKU must result in exactly one success and one 409.

### Layer 1 — Redis distributed lock

When a reservation request arrives for `productId + warehouseId`, we immediately try to acquire a Redis lock using `SET NX PX` (atomic set-if-not-exists with TTL). Only one process can hold this lock at a time. If the lock is already held, the second request gets a **429** and should retry.

```
Request A arrives  → SET lock:prod-1:wh-1  NX PX 5000 → OK   (lock acquired)
Request B arrives  → SET lock:prod-1:wh-1  NX PX 5000 → nil  (lock busy → 429)
```

The lock is released in a `finally` block using a Lua script that only deletes the key if the value still matches (prevents a slow request from releasing another process's lock after the TTL has expired).

### Layer 2 — Postgres SELECT FOR UPDATE

Inside a serializable transaction, we issue:

```sql
SELECT id, total, reserved FROM "Stock"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE
```

This acquires a **row-level exclusive lock** in Postgres. Any concurrent transaction touching the same row blocks here until the first commits or rolls back. This means even if Redis is down, or two servers share no Redis instance, the DB prevents double-booking.

The reservation and stock update happen atomically in the same transaction — there's no window where stock is decremented without a reservation record (or vice versa).

**Why both layers?** Redis lock is faster (prevents DB contention before it starts). Postgres lock is the hard safety guarantee. Defense in depth.

---

## How expiry works in production

### Approach: Vercel Cron + lazy cleanup on reads

**Lazy cleanup (immediate correctness):**

Every call to `GET /api/products` triggers `releaseExpiredReservations()` before computing available counts. Every `POST /reservations/:id/confirm` also checks expiry before confirming. This means the user always sees accurate stock and never confirms an expired reservation, even if the cron hasn't run yet.

**Vercel Cron (background recovery):**

`vercel.json` schedules `GET /api/cron/release-expired` to run every minute. This handles cases where no reads happen for a while — the stock returns to the pool regardless.

```json
{
  "crons": [{ "path": "/api/cron/release-expired", "schedule": "* * * * *" }]
}
```

The expiry handler uses a Postgres transaction to atomically update `reservation.status = RELEASED` and decrement `stock.reserved` together — no partial state is possible.

**Why not a background worker?** Vercel's serverless model doesn't support long-running processes. The cron + lazy approach covers both the "background sweep" and "real-time read" cases with no additional infrastructure.

---

## Idempotency

`POST /reservations` and `POST /reservations/:id/confirm` support an optional `Idempotency-Key` header.

**Implementation:**

1. On arrival, look up the key in the `IdempotencyRecord` table.
2. If found and not expired, return the original status code + body immediately.
3. If not found, proceed normally and persist the response before returning.
4. Records expire after 24 hours (configurable).

This means retrying a payment confirmation after a network timeout won't create a double-charge or double-decrement — the server recognises the retry and returns the original result.

**Why Postgres and not Redis for idempotency?** The idempotency record needs to outlive a Redis restart and be durable alongside the reservation data. Postgres is the right store for this.

---

## API reference

| Method | Path | Behaviour |
|--------|------|-----------|
| GET | `/api/products` | List products with available stock per warehouse. Triggers lazy expiry cleanup. |
| GET | `/api/warehouses` | List all warehouses. |
| POST | `/api/reservations` | Reserve units. Returns 409 if insufficient stock, 429 if lock contention. |
| GET | `/api/reservations/:id` | Fetch a single reservation. |
| POST | `/api/reservations/:id/confirm` | Confirm (payment succeeded). Returns 410 if expired. |
| POST | `/api/reservations/:id/release` | Release early (payment failed or cancelled). Idempotent. |
| GET | `/api/cron/release-expired` | Internal cron endpoint. Releases all expired PENDING reservations. |

---

## Data model

```
Product         Warehouse
   │                │
   └─── Stock ───── ┘    (total, reserved, available = total - reserved)
   │                │
   └─ Reservation ──┘    (status: PENDING → CONFIRMED | RELEASED, expiresAt)

IdempotencyRecord         (key, endpoint, statusCode, responseBody, expiresAt)
```

---

## Trade-offs and things I'd do differently

**What I simplified:**
- **No auth** — a real system would scope reservations to a user/session so only the buyer can confirm their own reservation.
- **No payment integration** — the "Confirm" button simulates a payment succeeding. In production this would call a payment gateway and confirm only on webhook receipt.
- **Single reservation per request** — no cart concept. A real checkout might reserve multiple SKUs atomically.
- **Cron granularity** — Vercel Cron minimum is 1 minute. For a high-volume system I'd use a queue (BullMQ, SQS) with per-reservation timers.

**What I'd add with more time:**
- Optimistic UI updates with SWR/React Query + polling
- Webhook-driven confirm flow (Stripe → `/api/webhooks/stripe`)
- Per-user reservation limits
- Admin dashboard showing live reservation activity
- Load test demonstrating the concurrency guarantee (k6 or Artillery script)
- Soft-delete and audit log for reservation state changes

**On the Redis fallback:**
If `REDIS_URL` is not set, the lock module returns a no-op releaser and the system falls back entirely to Postgres `SELECT FOR UPDATE`. This is correct but slower under high concurrency — you'll see more DB contention. The app won't break, it just won't scale as well.

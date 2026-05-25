import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock } from "@/lib/lock";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/idempotency";
import { CreateReservationSchema } from "@/lib/schemas";

const RESERVATION_WINDOW_MINUTES = 10;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate input
  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // ── Idempotency ──────────────────────────────────────────────────────────────
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey, "POST /api/reservations");
    if (cached) return cached;
  }

  // ── Distributed Lock ─────────────────────────────────────────────────────────
  // Lock key is scoped to the specific product+warehouse combination.
  // This prevents two concurrent requests for the same SKU from both
  // reading "5 available" and both succeeding, leaving us with -1 available.
  const lockKey = `reservation:${productId}:${warehouseId}`;
  const releaseLock = await acquireLock(lockKey, 5000);

  if (releaseLock === null) {
    // Lock contention — another request is processing the same SKU right now.
    // Return 429 so the client can retry after a short delay.
    return NextResponse.json(
      { error: "Another reservation is in progress for this item. Please retry in a moment." },
      { status: 429 }
    );
  }

  try {
    // ── Core Reservation Logic (inside a DB transaction) ─────────────────────
    //
    // We use SELECT ... FOR UPDATE on the Stock row inside a serializable
    // transaction. This gives us two layers of protection:
    //   1. Redis distributed lock (fast path) — rejects concurrent requests
    //      before they hit the DB.
    //   2. Postgres row-level lock (slow path) — prevents double-booking even
    //      if Redis is unavailable or two processes share no Redis instance.
    //
    const result = await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE — any concurrent transaction touching this row
      // will block here until we commit or roll back.
      const stocks = await tx.$queryRaw<
        Array<{ id: string; total: number; reserved: number }>
      >`
        SELECT id, total, reserved
        FROM "Stock"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (stocks.length === 0) {
        return { error: "Stock record not found for this product/warehouse", status: 404 };
      }

      const stock = stocks[0];
      const available = stock.total - stock.reserved;

      if (available < quantity) {
        return {
          error: `Not enough stock. Requested ${quantity}, available ${available}.`,
          status: 409,
        };
      }

      // Increment reserved count
      await tx.stock.update({
        where: { id: stock.id },
        data: { reserved: { increment: quantity } },
      });

      const expiresAt = new Date(
        Date.now() + RESERVATION_WINDOW_MINUTES * 60 * 1000
      );

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
        },
        include: {
          product: { select: { id: true, name: true, price: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, city: true } },
        },
      });

      return { reservation, status: 201 };
    });

    if ("error" in result) {
      const response = { error: result.error };
      if (idempotencyKey) {
        await saveIdempotentResponse(
          idempotencyKey,
          "POST /api/reservations",
          result.status,
          response
        );
      }
      return NextResponse.json(response, { status: result.status });
    }

    const responseBody = result.reservation;
    if (idempotencyKey) {
      await saveIdempotentResponse(
        idempotencyKey,
        "POST /api/reservations",
        201,
        responseBody
      );
    }

    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    await releaseLock();
  }
}

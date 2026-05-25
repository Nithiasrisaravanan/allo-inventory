import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/idempotency";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // ── Idempotency ──────────────────────────────────────────────────────────────
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const endpoint = `POST /api/reservations/${id}/confirm`;
    const cached = await getIdempotentResponse(idempotencyKey, endpoint);
    if (cached) return cached;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the reservation row to prevent concurrent confirms
    const reservations = await tx.$queryRaw<
      Array<{ id: string; status: string; expiresAt: Date; quantity: number; productId: string; warehouseId: string }>
    >`
      SELECT id, status, "expiresAt", quantity, "productId", "warehouseId"
      FROM "Reservation"
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (reservations.length === 0) {
      return { error: "Reservation not found", status: 404 };
    }

    const reservation = reservations[0];

    if (reservation.status === "CONFIRMED") {
      return { error: "Reservation already confirmed", status: 409 };
    }

    if (reservation.status === "RELEASED") {
      return { error: "Reservation was already released", status: 410 };
    }

    // Check expiry
    if (new Date(reservation.expiresAt) < new Date()) {
      // Also release stock since it's expired
      await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      });
      return { error: "Reservation has expired. Please start a new reservation.", status: 410 };
    }

    // Confirm: mark confirmed and decrement actual stock
    const now = new Date();
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: now },
      include: {
        product: { select: { id: true, name: true, price: true, imageUrl: true } },
        warehouse: { select: { id: true, name: true, city: true } },
      },
    });

    // Stock is decremented from total and reserved cleared
    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        total: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });

    return { reservation: updated, status: 200 };
  });

  const endpoint = `POST /api/reservations/${id}/confirm`;

  if ("error" in result) {
    const response = { error: result.error };
    if (idempotencyKey) {
      await saveIdempotentResponse(idempotencyKey, endpoint, result.status, response);
    }
    return NextResponse.json(response, { status: result.status });
  }

  if (idempotencyKey) {
    await saveIdempotentResponse(idempotencyKey, endpoint, 200, result.reservation);
  }

  return NextResponse.json(result.reservation);
}

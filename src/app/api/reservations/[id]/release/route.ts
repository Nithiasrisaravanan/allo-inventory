import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const result = await prisma.$transaction(async (tx) => {
    const reservations = await tx.$queryRaw<
      Array<{ id: string; status: string; quantity: number; productId: string; warehouseId: string }>
    >`
      SELECT id, status, quantity, "productId", "warehouseId"
      FROM "Reservation"
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (reservations.length === 0) {
      return { error: "Reservation not found", status: 404 };
    }

    const reservation = reservations[0];

    if (reservation.status === "CONFIRMED") {
      return { error: "Cannot release a confirmed reservation", status: 409 };
    }

    if (reservation.status === "RELEASED") {
      // Idempotent — releasing an already-released reservation is fine
      return { message: "Reservation already released", status: 200 };
    }

    const now = new Date();
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: now },
      include: {
        product: { select: { id: true, name: true, price: true, imageUrl: true } },
        warehouse: { select: { id: true, name: true, city: true } },
      },
    });

    // Return stock to available pool
    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: { reserved: { decrement: reservation.quantity } },
    });

    return { reservation: updated, status: 200 };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if ("message" in result) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.reservation);
}

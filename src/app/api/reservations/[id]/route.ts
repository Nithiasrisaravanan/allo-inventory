import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, price: true, imageUrl: true } },
      warehouse: { select: { id: true, name: true, city: true } },
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json(reservation);
}

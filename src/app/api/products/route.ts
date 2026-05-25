import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // Lazy cleanup: release expired reservations so available counts are accurate
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stock: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price,
    stock: product.stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseCity: s.warehouse.city,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}

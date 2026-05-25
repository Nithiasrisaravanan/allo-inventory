import { prisma } from "./prisma";

/**
 * Release all expired PENDING reservations and return stock to available.
 *
 * This is called lazily:
 *   1. Before any GET /api/products response (so stock counts are accurate)
 *   2. Before confirming a reservation (so we catch expired ones)
 *
 * In production this is ALSO run via a Vercel Cron job every minute
 * (see /api/cron/release-expired) so stock recovers even if no one
 * hits those endpoints.
 *
 * Using a Postgres transaction ensures atomicity — we never release stock
 * without updating the reservation status, or vice versa.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
  });

  if (expired.length === 0) return 0;

  // Process each expired reservation atomically
  let released = 0;
  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "RELEASED", releasedAt: now },
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
    });
    released++;
  }

  return released;
}

import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

/**
 * Called by Vercel Cron every minute (see vercel.json).
 * Releases any PENDING reservations that have passed their expiresAt.
 *
 * Protected by a simple bearer token to prevent public invocation.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredReservations();

  return NextResponse.json({
    ok: true,
    released,
    timestamp: new Date().toISOString(),
  });
}

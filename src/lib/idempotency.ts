import { prisma } from "./prisma";
import { NextResponse } from "next/server";

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Check if a request with this idempotency key has been seen before.
 * Returns the cached response if found, otherwise null.
 */
export async function getIdempotentResponse(
  key: string,
  endpoint: string
): Promise<NextResponse | null> {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { key: `${endpoint}:${key}` },
  });

  if (!record) return null;

  // Check if it's expired
  if (record.expiresAt < new Date()) {
    await prisma.idempotencyRecord.delete({ where: { id: record.id } });
    return null;
  }

  const body = JSON.parse(record.responseBody);
  return NextResponse.json(body, { status: record.statusCode });
}

/**
 * Save a response for an idempotency key.
 */
export async function saveIdempotentResponse(
  key: string,
  endpoint: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000
  );

  await prisma.idempotencyRecord.upsert({
    where: { key: `${endpoint}:${key}` },
    update: {
      statusCode,
      responseBody: JSON.stringify(body),
      expiresAt,
    },
    create: {
      key: `${endpoint}:${key}`,
      endpoint,
      statusCode,
      responseBody: JSON.stringify(body),
      expiresAt,
    },
  });
}

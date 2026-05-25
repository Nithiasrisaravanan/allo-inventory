import { redis } from "./redis";

const LOCK_TTL_MS = 5000; // 5 seconds max lock hold time

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns a release function, or null if the lock could not be acquired.
 *
 * Falls back gracefully if Redis is unavailable — in that case we rely
 * on the Postgres SELECT ... FOR UPDATE in the reservation logic itself.
 */
export async function acquireLock(
  key: string,
  ttlMs: number = LOCK_TTL_MS
): Promise<(() => Promise<void>) | null> {
  if (!redis) {
    // No Redis — return a no-op releaser so callers don't need to branch.
    // The DB-level FOR UPDATE lock still prevents double-booking.
    return async () => {};
  }

  const lockKey = `lock:${key}`;
  const lockValue = `${Date.now()}-${Math.random()}`;

  const result = await redis.set(lockKey, lockValue, "PX", ttlMs, "NX");

  if (result !== "OK") {
    return null; // Lock not acquired — another process holds it
  }

  const release = async () => {
    // Lua script: only delete if we still own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis!.eval(script, 1, lockKey, lockValue);
    } catch {
      // Lock may have already expired — that's fine
    }
  };

  return release;
}

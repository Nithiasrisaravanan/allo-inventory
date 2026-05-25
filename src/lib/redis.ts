import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL not set — distributed locking disabled (not safe for production)");
    return null;
  }
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  client.on("error", (err) => console.error("Redis error:", err));
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis ?? undefined;
}

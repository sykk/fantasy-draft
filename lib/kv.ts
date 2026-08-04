import { promises as fs } from "fs";
import path from "path";

const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "kv-store.json");

async function readLocalStore(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeLocalStore(store: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}

function hasRedisConfig(): boolean {
  const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!configured && process.env.VERCEL) {
    throw new Error("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are required in deployed environments");
  }
  return configured;
}

async function getRedisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // Store/return raw strings as-is — we're persisting an already
    // JSON-stringified envelope, and Upstash's default auto-deserialization
    // would otherwise silently JSON.parse it into an object.
    automaticDeserialization: false,
  });
}

export async function kvGet(key: string): Promise<string | null> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    const value = await redis.get<string>(key);
    return value ?? null;
  }
  const store = await readLocalStore();
  return store[key] ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    await redis.set(key, value);
    return;
  }
  const store = await readLocalStore();
  store[key] = value;
  await writeLocalStore(store);
}

export async function kvDelete(key: string): Promise<void> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    await redis.del(key);
    return;
  }
  const store = await readLocalStore();
  delete store[key];
  await writeLocalStore(store);
}

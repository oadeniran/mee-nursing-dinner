import { MongoClient, Db } from "mongodb";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  const client = new MongoClient(env.mongodbUri);
  global._mongoClientPromise = client.connect();
}
const clientPromise = global._mongoClientPromise;

let indexesReady: Promise<void> | null = null;
async function ensureIndexes(db: Db) {
  try {
    // Auto-delete expired OTPs, and one live OTP per email+purpose.
    await db.collection("otps").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("otps").createIndex({ email: 1, purpose: 1 }, { unique: true });
    await db.collection("orders").createIndex({ email: 1 }, { unique: true });
  } catch (e) {
    console.error("index ensure failed", e);
  }
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(env.mongodbDb);
  if (!indexesReady) indexesReady = ensureIndexes(db);
  await indexesReady;
  return db;
}
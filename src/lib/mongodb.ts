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

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(env.mongodbDb);
}
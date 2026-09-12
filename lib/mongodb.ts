import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName =
  process.env.MONGODB_DB || "personal-project-dashboard";

if (!uri) {
  throw new Error(
    "MONGODB_URI is missing. Add it to .env.local."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise:
    | Promise<MongoClient>
    | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);

    global._mongoClientPromise =
      client.connect();
  }

  clientPromise =
    global._mongoClientPromise;
} else {
  const client = new MongoClient(uri);

  clientPromise =
    client.connect();
}

export async function getDb() {
  const client = await clientPromise;

  return client.db(dbName);
}
import type { AnyBulkWriteOperation, Document } from "mongodb";
import mongoose from "mongoose";

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
        legacyChecked: boolean;
      }
    | null;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null, legacyChecked: false };
}

function getDbName() {
  return (
    process.env.MONGODB_DB ||
    process.env.MONGODB_DATABASE ||
    process.env.MONGO_DB ||
    process.env.MONGO_DB_NAME ||
    "crm_v1"
  );
}

async function reconcileLegacyCollections(conn: typeof mongoose) {
  if (cached?.legacyChecked) return;

  const db = conn.connection.db;
  if (!db) return;

  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  const hasCompanies = collections.includes("companies");
  const hasLeads = collections.includes("leads");

  if (!hasLeads) {
    cached!.legacyChecked = true;
    return;
  }

  const leadsCollection = db.collection("leads");

  if (!hasCompanies) {
    try {
      await leadsCollection.rename("companies");
      cached!.legacyChecked = true;
      return;
    } catch {
      // If rename is blocked by DB permissions, continue with a copy-forward fallback.
    }
  }

  const companiesCollection = db.collection("companies");
  const leadsCount = await leadsCollection.estimatedDocumentCount();

  if (leadsCount === 0) {
    cached!.legacyChecked = true;
    return;
  }

  // Backfill legacy `leads` docs into `companies` without overwriting existing records.
  // This preserves data when both collections exist (common in partial migrations).
  // Use small batches to avoid loading large legacy collections into memory.
  const BATCH_SIZE = 500;
  let ops: AnyBulkWriteOperation<Document>[] = [];

  const cursor = leadsCollection.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc?._id) continue;

    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    });

    if (ops.length >= BATCH_SIZE) {
      await companiesCollection.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }

  if (ops.length > 0) {
    await companiesCollection.bulkWrite(ops, { ordered: false });
  }

  cached!.legacyChecked = true;
}

export async function connectDb() {
  if (cached?.conn) {
    if (!cached.legacyChecked) {
      await reconcileLegacyCollections(cached.conn);
    }
    return cached.conn;
  }

  if (!cached?.promise) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not configured");
    }

    cached!.promise = mongoose.connect(mongoUri, {
      dbName: getDbName(),
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
  }

  cached!.conn = await cached!.promise;
  await reconcileLegacyCollections(cached!.conn);

  return cached!.conn;
}

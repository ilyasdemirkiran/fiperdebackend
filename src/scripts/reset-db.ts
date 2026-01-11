import { MongoClient } from "mongodb";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Error: DATABASE_URL environment variable is not defined.");
  console.error("Usage: DATABASE_URL='mongodb://...' bun src/scripts/reset-db.ts");
  process.exit(1);
}

// Mask password in logs
const maskedUrl = url.replace(/:([^:@]+)@/, ":****@");
console.log(`🔌 Connecting to database... (${maskedUrl})`);

const client = new MongoClient(url);

async function main() {
  try {
    await client.connect();
    console.log("✅ Connected successfully to MongoDB");

    const db = client.db();
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log("ℹ️ No collections found to drop.");
      return;
    }

    console.log(`🗑️ Found ${collections.length} collections. Dropping them now...`);

    for (const collection of collections) {
      // Skip system collections
      if (collection.name.startsWith("system.")) {
        continue;
      }

      try {
        await db.collection(collection.name).drop();
        console.log(`   - Dropped: ${collection.name}`);
      } catch (e) {
        console.error(`   ❌ Failed to drop ${collection.name}:`, e);
      }
    }

    console.log("✨ All specified collections have been dropped.");
  } catch (error) {
    console.error("❌ An error occurred:", error);
  } finally {
    await client.close();
    console.log("👋 Connection closed.");
  }
}

main();

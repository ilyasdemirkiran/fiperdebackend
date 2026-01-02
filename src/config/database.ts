import { MongoClient, Db } from "mongodb";
import { getMongoUri } from "./env";

let client: MongoClient | null = null;
const dbCache: Map<string, Db> = new Map();

/**
 * Initialize MongoDB client connection (single connection pool for all databases)
 */
export async function connectDatabase() {
    if (client) {
        return client;
    }

    try {
        const uri = getMongoUri();
        console.log("🔌 Connecting to MongoDB...");

        client = new MongoClient(uri, {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
        });

        await client.connect();
        console.log("✅ Connected to MongoDB");

        return client;
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        throw error;
    }
}

/**
 * Get database for a specific company
 * Each company has its own database: fi_<companyId>
 */
export function getDatabaseForCompany(companyId: string): Db {
    if (!client) {
        throw new Error("Database not connected. Call connectDatabase() first.");
    }

    const dbName = `fi_${companyId}`;

    // Check cache first
    let db = dbCache.get(dbName);
    if (db) {
        return db;
    }

    // Create new db reference and cache it
    db = client.db(dbName);
    dbCache.set(dbName, db);

    // Schedule index creation (non-blocking)
    createIndexesForCompany(db).catch((err) => {
        console.error(`⚠️ Index creation warning for ${dbName}:`, err);
    });

    return db;
}

/**
 * Get global vendor database (shared across all companies)
 */
export function getGlobalVendorDatabase(): Db {
    if (!client) {
        throw new Error("Database not connected. Call connectDatabase() first.");
    }

    const dbName = "vendors_global";

    // Check cache first
    let db = dbCache.get(dbName);
    if (db) {
        return db;
    }

    // Create new db reference and cache it
    db = client.db(dbName);
    dbCache.set(dbName, db);

    // Schedule index creation (non-blocking)
    createVendorIndexes(db).catch((err) => {
        console.error(`⚠️ Vendor index creation warning:`, err);
    });

    return db;
}


/**
 * Create indexes for a company's database
 */
async function createIndexesForCompany(database: Db) {
    const customersCollection = database.collection("customers");
    const labelsCollection = database.collection("labels");
    const customerImagesCollection = database.collection("customer_images");
    const salesCollection = database.collection("sales");

    // Customer indexes
    await customersCollection.createIndex({ id: 1 }, { unique: true });
    await customersCollection.createIndex({ status: 1 });
    await customersCollection.createIndex({ createdAt: -1 });
    await customersCollection.createIndex({ name: 1, surname: 1 });

    // Label indexes
    await labelsCollection.createIndex({ id: 1 }, { unique: true });
    await labelsCollection.createIndex({ name: 1 });

    // CustomerImage indexes
    await customerImagesCollection.createIndex({ id: 1 }, { unique: true });
    await customerImagesCollection.createIndex({ customerId: 1 });
    await customerImagesCollection.createIndex({ uploadedAt: -1 });

    // Sale indexes
    await salesCollection.createIndex({ id: 1 }, { unique: true });
    await salesCollection.createIndex({ customerId: 1 });
    await salesCollection.createIndex({ status: 1 });
    await salesCollection.createIndex({ createdAt: -1 });

    console.log(`✅ Indexes created for ${database.databaseName}`);
}

/**
 * Create indexes for global vendor database
 */
async function createVendorIndexes(database: Db) {
    const vendorsCollection = database.collection("vendors");
    const productsCollection = database.collection("products");
    const attachmentsCollection = database.collection("vendor_attachments");
    const permissionsCollection = database.collection("vendor_permissions");

    // Vendor indexes
    await vendorsCollection.createIndex({ id: 1 }, { unique: true });
    await vendorsCollection.createIndex({ name: 1 });

    // Product indexes
    await productsCollection.createIndex({ id: 1 }, { unique: true });
    await productsCollection.createIndex({ vendorId: 1 });
    await productsCollection.createIndex({ name: 1 });

    // Attachment indexes
    await attachmentsCollection.createIndex({ id: 1 }, { unique: true });
    await attachmentsCollection.createIndex({ vendorId: 1 });

    // Permission indexes (KEY for performance)
    await permissionsCollection.createIndex(
        { companyId: 1, vendorId: 1 },
        { unique: true }
    );
    await permissionsCollection.createIndex({ vendorId: 1 });

    console.log(`✅ Vendor indexes created for ${database.databaseName}`);
}

/**
 * Get MongoDB client for transaction support
 */
export function getClient(): MongoClient {
    if (!client) {
        throw new Error("Database not connected. Call connectDatabase() first.");
    }
    return client;
}

export async function closeDatabase() {
    if (client) {
        await client.close();
        client = null;
        dbCache.clear();
        console.log("🔌 MongoDB connection closed");
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    await closeDatabase();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await closeDatabase();
    process.exit(0);
});

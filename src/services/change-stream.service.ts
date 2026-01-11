import { getGlobalVendorDatabase } from "@/config/database";
import { broadcastToAll } from "@/config/websocket";
import { logger } from "@/utils/logger";
import type { ChangeStreamDocument } from "mongodb";

// Collections to watch for real-time updates
const WATCHED_COLLECTIONS = [
  "vendors",
  "products",
  "vendor_permissions",
] as const;

type WatchedCollection = typeof WATCHED_COLLECTIONS[number];

interface ChangeEvent {
  collection: WatchedCollection;
  operationType: string;
  documentId?: string;
}

/**
 * Initialize MongoDB Change Streams for real-time updates
 * NOTE: Requires MongoDB replica set (single-node replica set works)
 */
export function initChangeStreams(): void {
  try {
    const db = getGlobalVendorDatabase();

    for (const collectionName of WATCHED_COLLECTIONS) {
      const collection = db.collection(collectionName);

      // Watch for all changes on this collection
      const changeStream = collection.watch([], {
        fullDocument: "updateLookup", // Include the full document on updates
      });

      changeStream.on("change", (change: ChangeStreamDocument) => {
        const event: ChangeEvent = {
          collection: collectionName,
          operationType: change.operationType,
          documentId: (change as any).documentKey?._id?.toString(),
        };

        logger.info("Change detected", event);

        // Broadcast to all connected WebSocket clients
        broadcastToAll(`${collectionName}:${change.operationType}`, event);
      });

      changeStream.on("error", (error) => {
        logger.error(`Change stream error for ${collectionName}`, error);
      });

      logger.info(`Watching collection for changes: ${collectionName}`);
    }

    logger.info("Change streams initialized successfully", {
      collections: WATCHED_COLLECTIONS,
    });
  } catch (error) {
    logger.error("Failed to initialize change streams", error);
    logger.warn("Change streams require a MongoDB replica set. Please configure your MongoDB as a replica set.");
  }
}

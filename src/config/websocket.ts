import type { ServerWebSocket } from "bun";
import { logger } from "@/utils/logger";

// Map of connected WebSocket clients
// Key: unique client ID, Value: WebSocket connection
const clients = new Map<string, ServerWebSocket<{ id: string }>>();

/**
 * Register a new WebSocket client
 */
export function registerClient(ws: ServerWebSocket<{ id: string }>): string {
  const id = crypto.randomUUID();
  clients.set(id, ws);
  logger.info("WebSocket client connected", { clientId: id, totalClients: clients.size });
  return id;
}

/**
 * Unregister a WebSocket client
 */
export function unregisterClient(id: string): void {
  clients.delete(id);
  logger.info("WebSocket client disconnected", { clientId: id, totalClients: clients.size });
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastToAll(eventType: string, data: unknown): void {
  const message = JSON.stringify({ type: eventType, data, timestamp: Date.now() });

  let sentCount = 0;
  for (const [id, ws] of clients) {
    try {
      ws.send(message);
      sentCount++;
    } catch (error) {
      logger.error("Failed to send message to client", { clientId: id, error });
      // Remove dead connections
      clients.delete(id);
    }
  }

  if (sentCount > 0) {
    logger.debug("Broadcast sent", { eventType, sentCount });
  }
}

/**
 * Get current connected client count
 */
export function getClientCount(): number {
  return clients.size;
}

export { clients };

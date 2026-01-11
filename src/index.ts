import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "@/config/env";
import { connectDatabase } from "@/config/database";
import { initializeFirebase } from "@/config/firebase";
import { customerRoutes } from "@/routes/customer.routes";
import { labelRoutes } from "@/routes/customer-image-label.routes";
import { customerImageRoutes } from "@/routes/customer-image.routes";
import { saleRoutes } from "@/routes/sale.routes";
import { vendorRoutes } from "@/routes/vendor.routes";
import { productRoutes } from "@/routes/product.routes";
import { vendorAttachmentRoutes } from "@/routes/vendor-attachment.routes";
import { managementRoutes } from "@/routes/management.routes";
import { priceListRequestRoutes } from "@/routes/price-list-request.routes";
import { errorHandler } from "@/middleware/error-handler";
import { logger, runWithContext } from "@/utils/logger";
import { successResponse } from "@/utils/response";
import { authRoutes } from "@/routes/auth.routes";
import { companyRoutes } from "@/routes/company.routes";
import { registerClient, unregisterClient, getClientCount } from "@/config/websocket";
import { initChangeStreams } from "@/services/change-stream.service";
import type { ServerWebSocket } from "bun";

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// CORS
app.use("/*", cors());

// Request logging middleware
app.use("*", async (c, next) => {
    return runWithContext(async () => {
        const startTime = Date.now();
        logger.request(c.req.method, c.req.path);

        await next();

        const duration = Date.now() - startTime;
        logger.response(c.req.method, c.req.path, c.res.status, duration);
    });
});

// Health check endpoint
app.get("/health", (c) => {
    return c.json(
        successResponse({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            wsClients: getClientCount(),
        })
    );
});

app.get("/", (c) => {
    return c.json(
        successResponse({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
        })
    );
});

// Mount routes
app.route("/api/auth", authRoutes);
app.route("/api/companies", companyRoutes);
app.route("/api/management", managementRoutes);
app.route("/api/price-list-requests", priceListRequestRoutes);
app.route("/api/customers", customerImageRoutes);
app.route("/api/customers", saleRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/labels", labelRoutes);
app.route("/api/vendors", vendorRoutes);
app.route("/api/vendors", vendorAttachmentRoutes);
app.route("/api/products", productRoutes);

// Initialize services
async function initialize() {
    try {
        logger.info("🚀 Starting Fiperde Backend...");

        // Initialize Firebase Admin SDK
        initializeFirebase();

        // Connect to MongoDB
        await connectDatabase();

        // Initialize Change Streams for real-time updates
        try {
            initChangeStreams();
            logger.info("📡 Change streams initialized");
        } catch (error) {
            logger.warn("Change streams not available - requires MongoDB replica set", error);
        }

        logger.info(`✅ Server ready on port ${env.PORT}`);
    } catch (error) {
        logger.error("Failed to initialize server", error);
        process.exit(1);
    }
}

// Start server
await initialize();

// WebSocket data type
type WebSocketData = { id: string };

export default {
    port: env.PORT,
    fetch: app.fetch,
    websocket: {
        open(ws: ServerWebSocket<WebSocketData>) {
            const id = registerClient(ws);
            ws.data = { id };
            logger.info("WebSocket opened", { id });
        },
        close(ws: ServerWebSocket<WebSocketData>) {
            if (ws.data?.id) {
                unregisterClient(ws.data.id);
            }
        },
        message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
            // Handle incoming messages if needed
            logger.debug("WebSocket message received", { id: ws.data?.id, message: message.toString() });
        },
    },
};

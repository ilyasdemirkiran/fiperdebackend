import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { QuoteService } from "@/services/quote.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import {
  createQuoteSchema,
  updateQuoteCustomerSchema,
  updateQuoteConversionsSchema,
  addRoomSchema,
  updateRoomNameSchema,
  addItemsToRoomSchema,
  updateQuoteItemSchema,
  type Quote
} from "@/types/quotes/quote";

export const quoteRoutes = new Hono<Env>();

let service: QuoteService | null = null;

function getService(): QuoteService {
  if (!service) {
    service = new QuoteService();
  }
  return service;
}

// Apply auth middleware
quoteRoutes.use("*", authMiddleware);

// POST /api/quotes - Create draft
quoteRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { currency } = createQuoteSchema.parse(body);

  const quote = await getService().createQuote(
    user.companyId!,
    user._id!,
    `${user.name} ${user.surname}`,
    currency
  );
  return c.json(successResponse<Quote>(quote), 201);
});

// GET /api/quotes - List quotes (role-based)
quoteRoutes.get("/", async (c) => {
  const user = c.get("user");
  const quotes = await getService().listQuotes(user.companyId!, user._id!, user.role);
  return c.json(successResponse<Quote[]>(quotes));
});

// GET /api/quotes/:id - Get details
quoteRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const quote = await getService().getQuote(user.companyId!, id);
  return c.json(successResponse<Quote>(quote));
});

// PATCH /api/quotes/:id/customer - Set customer
quoteRoutes.patch("/:id/customer", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = updateQuoteCustomerSchema.parse(body);

  const quote = await getService().updateQuoteCustomer(user.companyId!, id, input);
  return c.json(successResponse<Quote>(quote));
});

// PATCH /api/quotes/:id/currency - Set currency
quoteRoutes.patch("/:id/currency", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const { currency } = createQuoteSchema.parse(body);

  const quote = await getService().updateQuoteCurrency(user.companyId!, id, currency);
  return c.json(successResponse<Quote>(quote));
});

// PATCH /api/quotes/:id/conversions - Set conversions
quoteRoutes.patch("/:id/conversions", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const conversions = updateQuoteConversionsSchema.parse(body);

  const quote = await getService().updateQuoteConversions(user.companyId!, id, conversions);
  return c.json(successResponse<Quote>(quote));
});

// POST /api/quotes/:id/rooms - Add room
quoteRoutes.post("/:id/rooms", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name } = addRoomSchema.parse(body);

  const quote = await getService().addRoom(user.companyId!, id, name);
  return c.json(successResponse<Quote>(quote), 201);
});

// PATCH /api/quotes/:id/rooms/:roomId - Update room name
quoteRoutes.patch("/:id/rooms/:roomId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const roomId = c.req.param("roomId");
  const body = await c.req.json();
  const { name } = updateRoomNameSchema.parse(body);

  const quote = await getService().updateRoomName(user.companyId!, id, roomId, name);
  return c.json(successResponse<Quote>(quote));
});

// DELETE /api/quotes/:id/rooms/:roomId - Delete room (and all its items)
quoteRoutes.delete("/:id/rooms/:roomId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const roomId = c.req.param("roomId");

  const quote = await getService().deleteRoom(user.companyId!, id, roomId);
  return c.json(successResponse<Quote>(quote));
});

// POST /api/quotes/:id/rooms/:roomId/items - Add items to room
quoteRoutes.post("/:id/rooms/:roomId/items", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const roomId = c.req.param("roomId");
  const body = await c.req.json();
  const { items } = addItemsToRoomSchema.parse(body);

  const quote = await getService().addItemsToRoom(user.companyId!, id, roomId, items);
  return c.json(successResponse<Quote>(quote), 201);
});

// PATCH /api/quotes/:id/rooms/:roomId/items/:itemId - Update item
quoteRoutes.patch("/:id/rooms/:roomId/items/:itemId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const roomId = c.req.param("roomId");
  const itemId = c.req.param("itemId");
  const body = await c.req.json();
  const updates = updateQuoteItemSchema.parse(body);

  const quote = await getService().updateItem(user.companyId!, id, roomId, itemId, updates);
  return c.json(successResponse<Quote>(quote));
});

// DELETE /api/quotes/:id/rooms/:roomId/items/:itemId - Remove item
quoteRoutes.delete("/:id/rooms/:roomId/items/:itemId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const roomId = c.req.param("roomId");
  const itemId = c.req.param("itemId");

  const quote = await getService().removeItem(user.companyId!, id, roomId, itemId);
  return c.json(successResponse<Quote>(quote));
});

// POST /api/quotes/:id/submit - Submit for approval
quoteRoutes.post("/:id/submit", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const quote = await getService().submitForApproval(user.companyId!, id);
  return c.json(successResponse<Quote>(quote));
});

// POST /api/quotes/:id/approve - Approve
quoteRoutes.post("/:id/approve", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const quote = await getService().approveQuote(user.companyId!, id);
  return c.json(successResponse<Quote>(quote));
});

// POST /api/quotes/:id/deny - Deny
quoteRoutes.post("/:id/deny", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const quote = await getService().denyQuote(user.companyId!, id);
  return c.json(successResponse<Quote>(quote));
});

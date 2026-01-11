import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { PriceListRequestService } from "@/services/price-list-request.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";

export const priceListRequestRoutes = new Hono<Env>();

let service: PriceListRequestService | null = null;

function getService(): PriceListRequestService {
  if (!service) {
    service = new PriceListRequestService();
  }
  return service;
}

// Apply auth middleware
priceListRequestRoutes.use("*", authMiddleware);

// POST /api/price-list-requests - Submit a price list request (admin users)
priceListRequestRoutes.post("/", async (c) => {
  const user = c.get("user");

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const vendorName = formData.get("vendorName") as string;
  const companyName = formData.get("companyName") as string || "";

  if (!file) {
    return c.json({ success: false, error: { message: "File is required" } }, 400);
  }

  if (!vendorName || vendorName.trim().length < 2) {
    return c.json({ success: false, error: { message: "Vendor name is required (min 2 characters)" } }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await getService().submitRequest(
    user,
    companyName,
    {
      vendorName: vendorName.trim(),
      filename: file.name,
      mimeType: file.type,
      data: buffer,
    }
  );

  return c.json(successResponse(result), 201);
});

// GET /api/price-list-requests - List my company's requests (admin)
priceListRequestRoutes.get("/", async (c) => {
  const user = c.get("user");

  const requests = await getService().listRequestsForCompany(user);
  return c.json(successResponse(requests));
});

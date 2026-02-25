import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { VendorService } from "@/services/vendor.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { ObjectId } from "mongodb";

export const vendorPriceRateRoutes = new Hono<Env>();

let service: VendorService | null = null;

function getService(): VendorService {
  if (!service) {
    service = new VendorService();
  }
  return service;
}

// Apply auth middleware
vendorPriceRateRoutes.use("*", authMiddleware);

// Input schema for bulk update
const bulkUpdateSchema = z.array(
  z.object({
    vendorId: z.string().min(1),
    rate: z.number().min(0).max(100),
  })
);

// GET /api/vendor-price-rates - Get price rates for company's available vendors
vendorPriceRateRoutes.get("/", async (c) => {
  const user = c.get("user");

  const rates = await getService().getPriceRatesForCompany(user.companyId!);
  return c.json(successResponse(rates));
});

// PUT /api/vendor-price-rates - Bulk update price rates (admin/sudo only)
vendorPriceRateRoutes.put("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const rates = bulkUpdateSchema.parse(body);

  const mappedRates = rates.map((r) => ({
    vendorId: new ObjectId(r.vendorId),
    rate: r.rate,
  }));

  await getService().updatePriceRates(user.role, mappedRates);

  return c.json(successResponse({ message: "Price rates updated successfully" }));
});

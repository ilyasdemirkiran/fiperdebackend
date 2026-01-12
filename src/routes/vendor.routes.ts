import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { VendorService } from "@/services/vendor.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { phoneNumberSchema } from "@/types/phone_number";

export const vendorRoutes = new Hono<Env>();

let service: VendorService | null = null;

function getService(): VendorService {
  if (!service) {
    service = new VendorService();
  }
  return service;
}

// Apply auth middleware
vendorRoutes.use("*", authMiddleware);

// Input schemas
const createVendorSchema = z.object({
  name: z.string().min(2, "Min 2 Karakter").max(100),
  phone: phoneNumberSchema,
  city: z.string().min(2, "Şehir seçilmelidir").max(100).optional(),
  district: z.string().min(2, "İlçe seçilmelidir").optional(),
  address: z.string().min(2).max(1000).optional(),
});

const updateVendorSchema = createVendorSchema.partial();

// GET /api/vendors - List vendors that company has permission to see
vendorRoutes.get("/", async (c) => {
  const user = c.get("user");

  // For client: only show permitted vendors
  const vendors = await getService().listVendorsForCompany(user.companyId!);
  return c.json(successResponse(vendors));
});

// GET /api/vendors/:id - Get single vendor
vendorRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const vendor = await getService().getVendor(id);
  return c.json(successResponse(vendor));
});

// GET /api/vendors/:id/document - Get latest document for vendor (PDF or Excel)
vendorRoutes.get("/:id/document", async (c) => {
  const vendorId = c.req.param("id");

  const result = await getService().getLatestDocument(vendorId);
  console.log('res', result)

  if (!result) {
    return c.json(successResponse(null));
  }

  // Return binary data with correct content type
  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.metadata.mimeType,
      "Content-Length": result.metadata.size.toString(),
      "Content-Disposition": `inline; filename="${result.metadata.filename}"`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

// GET /api/vendors/:id/document/metadata - Get latest document metadata only
vendorRoutes.get("/:id/document/metadata", async (c) => {
  const vendorId = c.req.param("id");

  const metadata = await getService().getLatestDocumentMetadata(vendorId);
  return c.json(successResponse(metadata));
});

// POST /api/vendors - Create vendor (sudo only)
vendorRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = createVendorSchema.parse(body);

  const vendor = await getService().createVendor(user.role, input);

  return c.json(successResponse(vendor), 201);
});

// PUT /api/vendors/:id - Update vendor (sudo only)
vendorRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = updateVendorSchema.parse(body);

  const vendor = await getService().updateVendor(user.role, id, input);

  return c.json(successResponse(vendor));
});

// DELETE /api/vendors/:id - Delete vendor (sudo only, cascade delete)
vendorRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await getService().deleteVendor(user.role, id);

  return c.json(successResponse({ message: "Vendor deleted successfully" }));
});

// ========== PERMISSION MANAGEMENT ==========

// POST /api/vendors/:id/permissions/:companyId - Grant access (sudo only)
vendorRoutes.post("/:id/permissions/:companyId", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const companyId = c.req.param("companyId");

  await getService().grantPermission(user.role, vendorId, companyId);

  return c.json(successResponse({ message: "Permission granted successfully" }), 201);
});

// DELETE /api/vendors/:id/permissions/:companyId - Revoke access (sudo only)
vendorRoutes.delete("/:id/permissions/:companyId", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const companyId = c.req.param("companyId");

  await getService().revokePermission(user.role, vendorId, companyId);

  return c.json(successResponse({ message: "Permission revoked successfully" }));
});

// GET /api/vendors/:id/permissions - List companies with access
vendorRoutes.get("/:id/permissions", async (c) => {
  const vendorId = c.req.param("id");

  const companyIds = await getService().getCompaniesForVendor(vendorId);

  return c.json(successResponse({ companyIds }));
});

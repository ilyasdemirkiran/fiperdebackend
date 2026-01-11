import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { ManagementService } from "@/services/management.service";
import { successResponse } from "@/utils/response";
import { toResponse, toResponseArray } from "@/utils/response-transformer";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";

export const managementRoutes = new Hono<Env>();

let service: ManagementService | null = null;

function getService(): ManagementService {
  if (!service) {
    service = new ManagementService();
  }
  return service;
}

// Apply auth middleware
managementRoutes.use("*", authMiddleware);

// =====================
// COMPANY ENDPOINTS
// =====================

// GET /management/companies - List all companies with users
managementRoutes.get("/companies", async (c) => {
  const user = c.get("user");
  const companies = await getService().listCompaniesWithUsers(user.role);
  return c.json(successResponse(toResponseArray(companies)));
});

// POST /management/companies/:id/promote/:userId - Promote user to admin
managementRoutes.post("/companies/:id/promote/:userId", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getService().promoteToAdmin(user.role, companyId, userId);
  return c.json(successResponse({ message: "User promoted to admin" }));
});

// POST /management/companies/:id/demote/:userId - Demote user from admin
managementRoutes.post("/companies/:id/demote/:userId", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getService().demoteFromAdmin(user.role, companyId, userId);
  return c.json(successResponse({ message: "User demoted from admin" }));
});

// =====================
// VENDOR ENDPOINTS
// =====================

// GET /management/vendors - List all vendors
managementRoutes.get("/vendors", async (c) => {
  const user = c.get("user");
  const vendors = await getService().listVendors(user.role);
  return c.json(successResponse(toResponseArray(vendors)));
});

// GET /management/vendors/:id - Get vendor with products
managementRoutes.get("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  const vendor = await getService().getVendorWithProducts(user.role, vendorId);
  return c.json(successResponse(toResponse(vendor)));
});

const vendorSchema = z.object({
  name: z.string().min(2),
  phone: z.string(),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
});

// POST /management/vendors - Create vendor
managementRoutes.post("/vendors", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const data = vendorSchema.parse(body);

  const vendor = await getService().createVendor(user.role, data);
  return c.json(successResponse(toResponse(vendor)), 201);
});

// PUT /management/vendors/:id - Update vendor
managementRoutes.put("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const data = vendorSchema.partial().parse(body);

  const vendor = await getService().updateVendor(user.role, vendorId, data);
  return c.json(successResponse(toResponse(vendor)));
});

// DELETE /management/vendors/:id - Delete vendor
managementRoutes.delete("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  await getService().deleteVendor(user.role, vendorId);
  return c.json(successResponse({ message: "Vendor deleted" }));
});

const accessSchema = z.object({
  companyIds: z.array(z.string()),
});

// PUT /management/vendors/:id/access - Set vendor access
managementRoutes.put("/vendors/:id/access", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const { companyIds } = accessSchema.parse(body);

  await getService().setVendorAccess(user.role, vendorId, companyIds);
  return c.json(successResponse({ message: "Vendor access updated" }));
});

// POST /management/vendors/:id/pdf - Upload vendor PDF (expects URL in body)
managementRoutes.post("/vendors/:id/pdf", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const { pdfUrl } = z.object({ pdfUrl: z.string() }).parse(body);

  await getService().updateVendorPdfUrl(user.role, vendorId, pdfUrl);
  return c.json(successResponse({ message: "PDF URL updated" }));
});

// =====================
// PRODUCT ENDPOINTS
// =====================

const productSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  price: z.number().positive(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

// POST /management/vendors/:vendorId/products - Create product
managementRoutes.post("/vendors/:vendorId/products", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("vendorId");
  const body = await c.req.json();
  const data = productSchema.parse(body);

  const product = await getService().createProduct(user.role, vendorId, data);
  return c.json(successResponse(toResponse(product)), 201);
});

// PUT /management/products/:id - Update product
managementRoutes.put("/products/:id", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("id");
  const body = await c.req.json();
  const data = productSchema.partial().parse(body);

  const product = await getService().updateProduct(user.role, productId, data);
  return c.json(successResponse(toResponse(product)));
});

// DELETE /management/products/:id - Delete product
managementRoutes.delete("/products/:id", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("id");

  await getService().deleteProduct(user.role, productId);
  return c.json(successResponse({ message: "Product deleted" }));
});

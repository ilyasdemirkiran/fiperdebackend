import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { ManagementService } from "@/services/management.service";
import { VendorService } from "@/services/vendor.service";
import { PriceListRequestService } from "@/services/price-list-request.service";
import { successResponse } from "@/utils/response";
import { toResponse, toResponseArray } from "@/utils/response-transformer";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";

export const managementRoutes = new Hono<Env>();

let managementService: ManagementService | null = null;
let vendorService: VendorService | null = null;
let priceListService: PriceListRequestService | null = null;

function getManagementService(): ManagementService {
  if (!managementService) {
    managementService = new ManagementService();
  }
  return managementService;
}

function getVendorService(): VendorService {
  if (!vendorService) {
    vendorService = new VendorService();
  }
  return vendorService;
}

function getPriceListService(): PriceListRequestService {
  if (!priceListService) {
    priceListService = new PriceListRequestService();
  }
  return priceListService;
}

// Apply auth middleware
managementRoutes.use("*", authMiddleware);

// =====================
// COMPANY ENDPOINTS
// =====================

// GET /management/companies - List all companies with users
managementRoutes.get("/companies", async (c) => {
  const user = c.get("user");
  const companies = await getManagementService().listCompaniesWithUsers(user.role);
  return c.json(successResponse(toResponseArray(companies)));
});

// POST /management/companies/:id/promote/:userId - Promote user to admin
managementRoutes.post("/companies/:id/promote/:userId", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getManagementService().promoteToAdmin(user.role, companyId, userId);
  return c.json(successResponse({ message: "User promoted to admin" }));
});

// POST /management/companies/:id/demote/:userId - Demote user from admin
managementRoutes.post("/companies/:id/demote/:userId", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getManagementService().demoteFromAdmin(user.role, companyId, userId);
  return c.json(successResponse({ message: "User demoted from admin" }));
});

// =====================
// VENDOR ENDPOINTS
// =====================

// GET /management/vendors - List all vendors
managementRoutes.get("/vendors", async (c) => {
  const user = c.get("user");
  const vendors = await getManagementService().listVendors(user.role);
  return c.json(successResponse(toResponseArray(vendors)));
});

// GET /management/vendors/:id - Get vendor with products
managementRoutes.get("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  const vendor = await getManagementService().getVendorWithProducts(user.role, vendorId);
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

  const vendor = await getManagementService().createVendor(user.role, data);
  return c.json(successResponse(toResponse(vendor)), 201);
});

// PUT /management/vendors/:id - Update vendor
managementRoutes.put("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const data = vendorSchema.partial().parse(body);

  const vendor = await getManagementService().updateVendor(user.role, vendorId, data);
  return c.json(successResponse(toResponse(vendor)));
});

// DELETE /management/vendors/:id - Delete vendor
managementRoutes.delete("/vendors/:id", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  await getManagementService().deleteVendor(user.role, vendorId);
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

  await getManagementService().setVendorAccess(user.role, vendorId, companyIds);
  return c.json(successResponse({ message: "Vendor access updated" }));
});

// GET /management/vendor-permissions - Get all vendor permissions
managementRoutes.get("/vendor-permissions", async (c) => {
  const user = c.get("user");

  const permissions = await getManagementService().listAllVendorPermissions(user.role);
  return c.json(successResponse(permissions));
});

// =====================
// VENDOR DOCUMENT ENDPOINTS
// =====================

// GET /management/vendors/:id/documents - Get all documents for a vendor (sudo only)
managementRoutes.get("/vendors/:id/documents", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  const documents = await getVendorService().getAllDocuments(user.role, vendorId);
  return c.json(successResponse(documents));
});

// POST /management/vendors/:id/documents - Upload document for vendor (sudo only)
managementRoutes.post("/vendors/:id/documents", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("id");

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const title = formData.get("title") as string || "";
  const description = formData.get("description") as string || "";

  if (!file) {
    return c.json({ success: false, error: { message: "File is required" } }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await getVendorService().uploadDocument(
    user.role,
    vendorId,
    user._id?.toString() || "",
    user.name,
    {
      filename: file.name,
      mimeType: file.type,
      data: buffer,
      title: title || file.name,
      description,
    }
  );

  return c.json(successResponse(result), 201);
});

// GET /management/documents/:id/download - Download a document
managementRoutes.get("/documents/:id/download", async (c) => {
  const documentId = c.req.param("id");

  const result = await getVendorService().getDocumentData(documentId);

  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.metadata.mimeType,
      "Content-Length": result.metadata.size.toString(),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.metadata.filename)}`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

// DELETE /management/documents/:id - Delete a document (sudo only)
managementRoutes.delete("/documents/:id", async (c) => {
  const user = c.get("user");
  const documentId = c.req.param("id");

  await getVendorService().deleteDocument(user.role, documentId);
  return c.json(successResponse({ message: "Document deleted" }));
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

  const product = await getManagementService().createProduct(user.role, vendorId, data);
  return c.json(successResponse(toResponse(product)), 201);
});

// PUT /management/products/:id - Update product
managementRoutes.put("/products/:id", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("id");
  const body = await c.req.json();
  const data = productSchema.partial().parse(body);

  const product = await getManagementService().updateProduct(user.role, productId, data);
  return c.json(successResponse(toResponse(product)));
});

// DELETE /management/products/:id - Delete product
managementRoutes.delete("/products/:id", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("id");

  await getManagementService().deleteProduct(user.role, productId);
  return c.json(successResponse({ message: "Product deleted" }));
});

// =====================
// PRICE LIST REQUEST ENDPOINTS
// =====================

// GET /management/price-list-requests - List all price list requests
managementRoutes.get("/price-list-requests", async (c) => {
  const user = c.get("user");

  const requests = await getPriceListService().listAllRequests(user.role);
  return c.json(successResponse(requests));
});

// GET /management/price-list-requests/pending - List pending requests
managementRoutes.get("/price-list-requests/pending", async (c) => {
  const user = c.get("user");

  const requests = await getPriceListService().listRequestsByStatus(user.role, "pending");
  return c.json(successResponse(requests));
});

// GET /management/price-list-requests/completed - List completed requests
managementRoutes.get("/price-list-requests/completed", async (c) => {
  const user = c.get("user");

  const requests = await getPriceListService().listRequestsByStatus(user.role, "completed");
  return c.json(successResponse(requests));
});

// GET /management/price-list-requests/:id/download - Download request file
managementRoutes.get("/price-list-requests/:id/download", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");

  const result = await getPriceListService().getRequestFile(user.role, requestId);

  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.metadata.mimeType,
      "Content-Length": result.metadata.size.toString(),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.metadata.filename)}`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

// PUT /management/price-list-requests/:id/complete - Complete a request
managementRoutes.put("/price-list-requests/:id/complete", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");

  const result = await getPriceListService().completeRequest(
    user.role,
    requestId,
    { userId: user._id?.toString() || "", name: user.name }
  );

  return c.json(successResponse(result));
});

// DELETE /management/price-list-requests/:id - Delete a request
managementRoutes.delete("/price-list-requests/:id", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");

  await getPriceListService().deleteRequest(user.role, requestId);
  return c.json(successResponse({ message: "Request deleted" }));
});

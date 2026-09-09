import {Hono} from "hono";
import type {Env} from "@/types/hono";
import {ManagementService} from "@/services/management.service";
import {VendorService} from "@/services/vendor.service";
import {successResponse} from "@/utils/response";
import {toResponse, toResponseArray} from "@/utils/response-transformer";
import {authMiddleware} from "@/middleware/auth";
import {z} from "zod";
import {managementAuthMiddleware} from "@/middleware/management-auth";

export const managementRoutes = new Hono<Env>();

// Apply auth middleware
managementRoutes.use("*", authMiddleware);
managementRoutes.use("*", managementAuthMiddleware);

let managementService: ManagementService | null = null;
let vendorService: VendorService | null = null;

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

// =====================
// COMPANY ENDPOINTS
// =====================

// GET /management/companies - List all companies with users
managementRoutes.get("/companies", async (c) => {
  const companies = await getManagementService().listCompaniesWithUsers();
  return c.json(successResponse(toResponseArray(companies)));
});

// POST /management/companies/:id/promote/:userId - Promote user to admin
managementRoutes.post("/companies/:id/promote/:userId", async (c) => {
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getManagementService().promoteToAdmin(companyId, userId);
  return c.json(successResponse({message: "User promoted to admin"}));
});

// POST /management/companies/:id/demote/:userId - Demote user from admin
managementRoutes.post("/companies/:id/demote/:userId", async (c) => {
  const companyId = c.req.param("id");
  const userId = c.req.param("userId");

  await getManagementService().demoteFromAdmin(companyId, userId);
  return c.json(successResponse({message: "User demoted from admin"}));
});

const setUserCompanySchema = z.object({
  companyId: z.string().min(1),
});

// PUT /management/users/:userId/company - Set user's companyId (sudo only)
managementRoutes.put("/users/:userId/company", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json();
  const {companyId} = setUserCompanySchema.parse(body);

  await getManagementService().setUserCompanyId(userId, companyId);
  return c.json(successResponse({message: "User company updated"}));
});

// DELETE /management/companies/:id - Delete company permanently (sudo only)
managementRoutes.delete("/companies/:id", async (c) => {
  const companyId = c.req.param("id");

  await getManagementService().deleteCompanyPermanently(companyId);
  return c.json(successResponse({message: "Company and all associated data permanently deleted"}));
});

const setCompanyDemoSchema = z.object({
  isDemo: z.boolean(),
});

// PUT /management/companies/:id/demo - Set or toggle company demo status (sudo only, only 1 company can be demo)
managementRoutes.put("/companies/:id/demo", async (c) => {
  const companyId = c.req.param("id");
  const body = await c.req.json();
  const {isDemo} = setCompanyDemoSchema.parse(body);

  const company = await getManagementService().setCompanyDemoStatus(companyId, isDemo);
  return c.json(successResponse(toResponse(company)));
});

// =====================
// VENDOR ENDPOINTS
// =====================

// GET /management/vendors - List all vendors
managementRoutes.get("/vendors", async (c) => {
  const vendors = await getManagementService().listVendors();
  return c.json(successResponse(toResponseArray(vendors)));
});

// GET /management/vendors/:id - Get vendor with products
managementRoutes.get("/vendors/:id", async (c) => {
  const vendorId = c.req.param("id");

  const vendor = await getManagementService().getVendorWithProducts(vendorId);
  return c.json(successResponse(toResponse(vendor)));
});

const vendorSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().transform((val) => (val && val.trim() !== "" ? val : undefined)),
  city: z.string().optional().transform((val) => (val && val.trim() !== "" ? val : undefined)),
  district: z.string().optional().transform((val) => (val && val.trim() !== "" ? val : undefined)),
  address: z.string().optional().transform((val) => (val && val.trim() !== "" ? val : undefined)),
});

// POST /management/vendors - Create vendor
managementRoutes.post("/vendors", async (c) => {
  const body = await c.req.json();
  const data = vendorSchema.parse(body);

  const vendor = await getManagementService().createVendor(data);
  return c.json(successResponse(toResponse(vendor)), 201);
});

// PUT /management/vendors/:id - Update vendor
managementRoutes.put("/vendors/:id", async (c) => {
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const data = vendorSchema.partial().parse(body);

  const vendor = await getManagementService().updateVendor(vendorId, data);
  return c.json(successResponse(toResponse(vendor)));
});

// DELETE /management/vendors/:id - Delete vendor
managementRoutes.delete("/vendors/:id", async (c) => {
  const vendorId = c.req.param("id");

  await getManagementService().deleteVendor(vendorId);
  return c.json(successResponse({message: "Vendor deleted"}));
});

// POST /management/vendors/:id/copy-to-company/:companyId - Copy master vendor to company DB (sudo only)
managementRoutes.post("/vendors/:id/copy-to-company/:companyId", async (c) => {
  const vendorId = c.req.param("id");
  const companyId = c.req.param("companyId");

  const result = await getManagementService().copyVendorToCompany(vendorId, companyId);
  return c.json(
    successResponse({
      message: "Vendor, products and documents copied to company successfully",
      ...result,
    }),
    201
  );
});

const accessSchema = z.object({
  companyIds: z.array(z.string()),
});

// PUT /management/vendors/:id/access - Set vendor access
managementRoutes.put("/vendors/:id/access", async (c) => {
  const vendorId = c.req.param("id");
  const body = await c.req.json();
  const {companyIds} = accessSchema.parse(body);

  await getManagementService().setVendorAccess(vendorId, companyIds);
  return c.json(successResponse({message: "Vendor access updated"}));
});

// GET /management/vendor-permissions - Get all vendor permissions
managementRoutes.get("/vendor-permissions", async (c) => {
  const permissions = await getManagementService().listAllVendorPermissions();
  return c.json(successResponse(permissions));
});

// POST /management/vendors/migrate-permitted-to-companies - Migration endpoint to copy all global vendors to permitted companies (sudo only)
managementRoutes.post("/vendors/migrate-permitted-to-companies", async (c) => {
  const result = await getManagementService().migratePermittedVendorsToCompanies();
  return c.json(
    successResponse({
      message: "Permitted vendors migration to companies completed",
      ...result,
    })
  );
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
    return c.json({success: false, error: {message: "File is required"}}, 400);
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
  return c.json(successResponse({message: "Document deleted"}));
});

// =====================
// PRODUCT ENDPOINTS
// =====================

const productSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  price: z.coerce.number().positive(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  description: z.string().optional().transform((val) => (val && val.trim() !== "" ? val : undefined)),
});

// POST /management/vendors/:vendorId/products - Create product
managementRoutes.post("/vendors/:vendorId/products", async (c) => {
  const vendorId = c.req.param("vendorId");
  const body = await c.req.json();
  const data = productSchema.parse(body);

  const product = await getManagementService().createProduct(vendorId, data);
  return c.json(successResponse(toResponse(product)), 201);
});

// PUT /management/products/:id - Update product
managementRoutes.put("/products/:id", async (c) => {
  const productId = c.req.param("id");
  const body = await c.req.json();
  const data = productSchema.partial().parse(body);

  const product = await getManagementService().updateProduct(productId, data);
  return c.json(successResponse(toResponse(product)));
});

// DELETE /management/products/:id - Delete product
managementRoutes.delete("/products/:id", async (c) => {
  const productId = c.req.param("id");

  await getManagementService().deleteProduct(productId);
  return c.json(successResponse({message: "Product deleted"}));
});

// =====================
// BULK PRODUCT ENDPOINTS
// =====================

const bulkProductSchema = z.object({
  products: z.array(productSchema).min(1, "En az 1 ürün gerekli"),
});

// POST /management/vendors/:vendorId/products/bulk - Bulk create products
managementRoutes.post("/vendors/:vendorId/products/bulk", async (c) => {
  const vendorId = c.req.param("vendorId");
  const body = await c.req.json();
  const {products} = bulkProductSchema.parse(body);

  const created = await getManagementService().bulkCreateProducts(vendorId, products);
  return c.json(successResponse(toResponseArray(created)), 201);
});

const bulkDeleteSchema = z.object({
  productIds: z.array(z.string()).min(1, "En az 1 ürün ID gerekli"),
});

// DELETE /management/vendors/:vendorId/products/bulk - Bulk delete products
managementRoutes.delete("/vendors/:vendorId/products/bulk", async (c) => {
  const vendorId = c.req.param("vendorId");
  const body = await c.req.json();
  const {productIds} = bulkDeleteSchema.parse(body);

  const deletedCount = await getManagementService().bulkDeleteProducts(vendorId, productIds);
  return c.json(successResponse({message: `${deletedCount} ürün silindi`, deletedCount}));
});

const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    productId: z.string(),
    data: productSchema.partial(),
  })).min(1, "En az 1 ürün güncellemesi gerekli"),
});

// PUT /management/vendors/:vendorId/products/bulk - Bulk update products
managementRoutes.put("/vendors/:vendorId/products/bulk", async (c) => {
  const vendorId = c.req.param("vendorId");
  const body = await c.req.json();
  const {updates} = bulkUpdateSchema.parse(body);

  const modifiedCount = await getManagementService().bulkUpdateProducts(vendorId, updates);
  return c.json(successResponse({message: `${modifiedCount} ürün güncellendi`, modifiedCount}));
});

// =====================
// COMPANY NOTE ENDPOINTS
// =====================

const companyNoteBodySchema = z.object({
  note: z.string().min(1, "Not içeriği boş olamaz"),
});

// GET /management/companies/:companyId/notes - List notes for a company
managementRoutes.get("/companies/:companyId/notes", async (c) => {
  const companyId = c.req.param("companyId");

  const notes = await getManagementService().listCompanyNotes(companyId);
  return c.json(successResponse(toResponseArray(notes)));
});

// POST /management/companies/:companyId/notes - Create a note for a company
managementRoutes.post("/companies/:companyId/notes", async (c) => {
  const companyId = c.req.param("companyId");
  const user = c.get("user");
  const body = await c.req.json();

  const {note} = companyNoteBodySchema.parse(body);

  const noteResult = await getManagementService().createCompanyNote(
    companyId,
    user._id!,
    note
  );

  return c.json(successResponse(toResponse(noteResult)), 201);
});

// PUT /management/companies/notes/:noteId - Update a company note
managementRoutes.put("/companies/notes/:noteId", async (c) => {
  const noteId = c.req.param("noteId");
  const body = await c.req.json();

  const {note} = companyNoteBodySchema.parse(body);

  const noteResult = await getManagementService().updateCompanyNote(noteId, note);
  return c.json(successResponse(toResponse(noteResult)));
});

// DELETE /management/companies/notes/:noteId - Delete a company note
managementRoutes.delete("/companies/notes/:noteId", async (c) => {
  const noteId = c.req.param("noteId");

  await getManagementService().deleteCompanyNote(noteId);
  return c.json(successResponse({message: "Company note deleted successfully"}));
});

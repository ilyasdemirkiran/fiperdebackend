import { Hono } from "hono";
import { Env } from "@/types/hono";
import { ProductService } from "@/services/product.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { currencySchema } from "@/types/currency";

export const productRoutes = new Hono<Env>();

let service: ProductService | null = null;

function getService(): ProductService {
  if (!service) {
    service = new ProductService();
  }
  return service;
}

// Apply auth middleware
productRoutes.use("*", authMiddleware);

// Input schemas
const createProductSchema = z.object({
  name: z.string().min(2, "En az 2 karakter gereklidir.").max(100),
  code: z.string().min(2, "En az 2 karakter gereklidir.").max(100),
  price: z.number().positive("Positive olmak zorunda"),
  currency: currencySchema,
  vendorId: z.string().min(1, "Tedarikçi seçilmelidir"),
  description: z.string().min(2).max(1000).optional(),
  imageUrl: z.string().url().optional(),
});

const updateProductSchema = createProductSchema.omit({ vendorId: true }).partial();

// GET /api/products - List products for user's company (permission-filtered)
productRoutes.get("/", async (c) => {
  const user = c.get("user");

  const products = await getService().listProductsForCompany(user.companyId!);

  return c.json(successResponse(products));
});

// GET /api/products/:id - Get product detail
productRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const product = await getService().getProduct(id);

  return c.json(successResponse(product));
});

// GET /api/products/vendor/:vendorId - List products by vendor (all users)
productRoutes.get("/vendor/:vendorId", async (c) => {
  const vendorId = c.req.param("vendorId");

  const products = await getService().listProductsByVendor(vendorId);

  return c.json(successResponse(products));
});

// POST /api/products - Create product (sudo only)
productRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = createProductSchema.parse(body);

  const product = await getService().createProduct(user.role, input);

  return c.json(successResponse(product), 201);
});

// PUT /api/products/:id - Update product (sudo only)
productRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = updateProductSchema.parse(body);

  const product = await getService().updateProduct(user.role, id, input);

  return c.json(successResponse(product));
});

// DELETE /api/products/:id - Delete product (sudo only)
productRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await getService().deleteProduct(user.role, id);

  return c.json(successResponse({ message: "Product deleted successfully" }));
});

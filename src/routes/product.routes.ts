import { Hono } from "hono";
import { type Env } from "@/types/hono";
import { ProductService } from "@/services/product.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { currencySchema } from "@/types/currency";
import { isEmpty } from "es-toolkit/compat";

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
  price: z.coerce.number().positive("Pozitif bir fiyat girilmelidir"),
  currency: currencySchema,
  vendorId: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : undefined)),
  description: z
    .string()
    .max(1000)
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : undefined)),
});

const updateProductSchema = createProductSchema.partial();

productRoutes.get("/list/all", async (c) => {
  const user = c.get("user");
  if (isEmpty(user.companyId)) {
    return c.json(successResponse([]));
  }

  const products = await getService().listAllProductsForCompany(user.companyId!);

  return c.json(successResponse(products));
});

// GET /api/products - List products for user's company (from company DB, with vendor & priceWithRate)
productRoutes.get("/", async (c) => {
  const user = c.get("user");

  const products = await getService().listProductsForCompany(user.companyId!);

  return c.json(successResponse(products));
});

// GET /api/products/vendor/:vendorId - List products by vendor (with vendor & priceWithRate)
productRoutes.get("/vendor/:vendorId", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("vendorId");

  const products = await getService().listProductsByVendor(user.companyId!, vendorId);

  return c.json(successResponse(products));
});

// GET /api/products/:id - Get product detail (with vendor & priceWithRate)
productRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const product = await getService().getProduct(user.companyId!, id);

  return c.json(successResponse(product));
});

// POST /api/products - Create product in company database
productRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = createProductSchema.parse(body);

  const product = await getService().createProduct(user.companyId!, input);

  return c.json(successResponse(product), 201);
});

// PUT /api/products/:id - Update product in company database
productRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = updateProductSchema.parse(body);

  const product = await getService().updateProduct(user.companyId!, id, input);

  return c.json(successResponse(product));
});

// DELETE /api/products/:id - Delete product from company database
productRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await getService().deleteProduct(user.companyId!, id);

  return c.json(successResponse({ message: "Product deleted successfully" }));
});

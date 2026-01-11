import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { SaleService } from "@/services/sale.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { toResponse, toResponseArray } from "@/utils/response-transformer";
import { currencySchema } from "@/types/currency";
import { paymentTypeSchema } from "@/types/customer/sale/payment_log";
import { timestampSchema } from "@/types/timestamp";

export const saleRoutes = new Hono<Env>();

let service: SaleService | null = null;

function getService(): SaleService {
  if (!service) {
    service = new SaleService();
  }
  return service;
}

// Apply auth middleware
saleRoutes.use("*", authMiddleware);

// Input schemas
const createSaleSchema = z.object({
  totalAmount: z.number().positive(),
  currency: currencySchema,
  description: z.string().optional(),
  createdAt: timestampSchema,
});

const updateSaleSchema = z.object({
  totalAmount: z.number().positive().optional(),
  currency: currencySchema.optional(),
  description: z.string().optional(),
  createdAt: timestampSchema.optional(),
});

const addPaymentLogSchema = z.object({
  amount: z.number().positive(),
  currency: currencySchema,
  paymentType: paymentTypeSchema,
  description: z.string().optional(),
  createdAt: timestampSchema.optional(),
});

const updatePaymentLogSchema = z.object({
  amount: z.number().positive().optional(),
  currency: currencySchema.optional(),
  paymentType: paymentTypeSchema.optional(),
  description: z.string().optional(),
  createdAt: timestampSchema.optional(),
});

// ========== SALE CRUD ==========

// GET /api/customers/:customerId/sales - List sales for customer
saleRoutes.get("/:customerId/sales", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");

  const sales = await getService().listSalesByCustomer(user.companyId!, customerId);

  return c.json(successResponse(toResponseArray(sales)));
});

// GET /api/customers/:customerId/sales/:saleId - Get single sale
saleRoutes.get("/:customerId/sales/:saleId", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");

  const sale = await getService().getSale(user.companyId!, saleId);

  return c.json(successResponse(toResponse(sale)));
});

// POST /api/customers/:customerId/sales - Create sale (admin only)
saleRoutes.post("/:customerId/sales", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const body = await c.req.json();

  const input = createSaleSchema.parse(body);

  const sale = await getService().createSale(
    user.companyId!,
    user._id!,
    `${user.name} ${user.surname}`,
    user.role,
    {
      customerId,
      createdByUserId: user._id!,
      createdByUserName: `${user.name} ${user.surname}`,
      totalAmount: input.totalAmount,
      currency: input.currency,
      status: "pending",
      description: input.description,
      createdAt: input.createdAt,
      logs: [],
    }
  );

  return c.json(successResponse(toResponse(sale)), 201);
});

// PUT /api/customers/:customerId/sales/:saleId - Update sale (admin only)
saleRoutes.put("/:customerId/sales/:saleId", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");
  const body = await c.req.json();

  const input = updateSaleSchema.parse(body);

  const sale = await getService().updateSale(user.companyId!, saleId, user.role, input);

  return c.json(successResponse(toResponse(sale)));
});

// DELETE /api/customers/:customerId/sales/:saleId - Delete sale (admin only)
saleRoutes.delete("/:customerId/sales/:saleId", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");

  await getService().deleteSale(user.companyId!, saleId, user.role);

  return c.json(successResponse({ message: "Sale deleted successfully" }));
});

// ========== PAYMENT LOG CRUD ==========

// POST /api/customers/:customerId/sales/:saleId/payments - Add payment log (admin only)
saleRoutes.post("/:customerId/sales/:saleId/payments", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");
  const body = await c.req.json();

  const input = addPaymentLogSchema.parse(body);

  const sale = await getService().addPaymentLog(
    user.companyId!,
    saleId,
    user._id?.toString()!,
    `${user.name} ${user.surname}`,
    user.role,
    input
  );

  return c.json(successResponse(toResponse(sale)), 201);
});

// PUT /api/customers/:customerId/sales/:saleId/payments/:logId - Update payment log (admin only)
saleRoutes.put("/:customerId/sales/:saleId/payments/:logId", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");
  const logId = c.req.param("logId");
  const body = await c.req.json();

  const input = updatePaymentLogSchema.parse(body);

  const sale = await getService().updatePaymentLog(
    user.companyId!,
    saleId,
    logId,
    user.role,
    input
  );

  return c.json(successResponse(toResponse(sale)));
});

// DELETE /api/customers/:customerId/sales/:saleId/payments/:logId - Delete payment log (admin only)
saleRoutes.delete("/:customerId/sales/:saleId/payments/:logId", async (c) => {
  const user = c.get("user");
  const saleId = c.req.param("saleId");
  const logId = c.req.param("logId");

  const sale = await getService().deletePaymentLog(
    user.companyId!,
    saleId,
    logId,
    user.role
  );

  return c.json(successResponse(toResponse(sale)));
});

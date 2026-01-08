import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { CustomerImageLabelService } from "@/services/customer-image-label.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";

export const labelRoutes = new Hono<Env>();

let service: CustomerImageLabelService | null = null;

function getService(): CustomerImageLabelService {
  if (!service) {
    service = new CustomerImageLabelService();
  }
  return service;
}

// Apply auth middleware
labelRoutes.use("*", authMiddleware);

// GET /api/labels - List all labels
labelRoutes.get("/", async (c) => {
  const user = c.get("user");
  const labels = await getService().listLabels(user.companyId!);
  return c.json(successResponse(labels));
});

// GET /api/labels/:id - Get single label
labelRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const label = await getService().getLabel(user.companyId!, id);
  return c.json(successResponse(label));
});

// Input schema for create/update
const labelInputSchema = z.object({
  name: z.string().min(1, "En az 1 karakter gereklidir."),
});

// POST /api/labels - Create label
labelRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = labelInputSchema.parse(body);
  const label = await getService().createLabel(user.companyId!, input.name);
  return c.json(successResponse(label), 201);
});

// PUT /api/labels/:id - Update label
labelRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = labelInputSchema.parse(body);
  const label = await getService().updateLabel(user.companyId!, id, input.name);
  return c.json(successResponse(label));
});

// DELETE /api/labels/:id - Delete label (with transaction)
labelRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await getService().deleteLabel(user.companyId!, id);
  return c.json(successResponse({ message: "Label deleted successfully" }));
});

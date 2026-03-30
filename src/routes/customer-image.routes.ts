import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { CustomerImageService, type UploadImageInput } from "@/services/customer-image.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { toResponse, toResponseArray } from "@/utils/response-transformer";
import { z } from "zod";
import type { CustomerImageMetadata } from "@/types/customer/image/customer_image";

export const customerImageRoutes = new Hono<Env>();

let service: CustomerImageService | null = null;

function getService(): CustomerImageService {
  if (!service) {
    service = new CustomerImageService();
  }
  return service;
}

// Apply auth middleware
customerImageRoutes.use("*", authMiddleware);

// GET /api/customers/images - List all images (no customerId filter)
customerImageRoutes.get("/images", async (c) => {
  const user = c.get("user");

  const images = await getService().listAllImages(user.companyId!);
  return c.json(successResponse(toResponseArray(images)));
});

// GET /api/customers/images/:imageId/download - Download image binary by imageId only
customerImageRoutes.get("/images/:imageId/download", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");

  const { buffer, metadata } = await getService().getImageData(user.companyId!, imageId);

  return new Response(buffer, {
    headers: {
      "Content-Type": metadata.mimeType,
      "Content-Length": metadata.size.toString(),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(metadata.filename)}`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

// GET /api/customers/:customerId/images - List images for customer (metadata only)
customerImageRoutes.get("/:customerId/images", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");

  const images = await getService().listImagesByCustomer(user.companyId!, customerId);
  return c.json(successResponse(toResponseArray(images)));
});

// POST /api/customers/images/by-labels - Get images by label IDs
const byLabelsSchema = z.object({
  labelIds: z.array(z.string()).default([]),
});

customerImageRoutes.post("/images/by-labels", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { labelIds } = byLabelsSchema.parse(body);

  const images = labelIds.length === 0
    ? await getService().listAllImages(user.companyId!)
    : await getService().getImagesByLabels(user.companyId!, labelIds);
  return c.json(successResponse(toResponseArray(images)));
});

// GET /api/customers/images/:imageId - Get image metadata
customerImageRoutes.get("/images/:imageId", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");

  const image = await getService().getImageMetadata(user.companyId!, imageId);
  return c.json(successResponse(toResponse(image)));
});

// Shared upload handler
async function handleImageUpload(c: any, customerId?: string) {
  const user = c.get("user");

  const formData = await c.req.formData();
  const files = formData.getAll("files") as File[];
  const description = formData.get("description") as string || "";
  const labelsStr = formData.get("labels") as string || "[]";

  let labels: string[] = [];
  try {
    labels = JSON.parse(labelsStr);
  } catch {
    labels = [];
  }

  if (files.length === 0) {
    return c.json({ success: false, error: { message: "No files provided" } }, 400);
  }

  const uploads: UploadImageInput[] = await Promise.all(
    files.map(async (file) => ({
      title: file.name, // Always use filename as title
      description,
      filename: file.name,
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      labels,
    }))
  );

  if (uploads.length === 1) {
    const image = await getService().uploadImage(
      user.companyId!,
      customerId,
      user._id?.toString()!,
      uploads[0]!
    );
    return c.json(successResponse(toResponse(image)), 201);
  } else {
    const images = await getService().uploadMultipleImages(
      user.companyId!,
      customerId,
      user._id?.toString()!,
      uploads
    );
    return c.json(successResponse(toResponseArray(images)), 201);
  }
}

// POST /api/customers/images - Upload image(s) without customerId
customerImageRoutes.post("/images", async (c) => {
  return handleImageUpload(c);
});

// POST /api/customers/:customerId/images - Upload image(s) with customerId
customerImageRoutes.post("/:customerId/images", async (c) => {
  const customerId = c.req.param("customerId");
  return handleImageUpload(c, customerId);
});

// PUT /api/customers/images/:imageId - Update image metadata
customerImageRoutes.put("/images/:imageId", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");
  const body = await c.req.json();

  const updateSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
  });

  const input = updateSchema.parse(body);
  const image: CustomerImageMetadata = await getService().updateImage(user.companyId!, imageId, input);

  return c.json(successResponse(toResponse(image)));
});

// DELETE /api/customers/images/:imageId - Delete image by imageId only
customerImageRoutes.delete("/images/:imageId", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");

  await getService().deleteImage(user.companyId!, imageId);

  return c.json(successResponse({ message: "Image deleted successfully" }));
});

// Resumable Upload Endpoints

// POST /api/customers/:customerId/upload/init - Initialize resumable upload
customerImageRoutes.post("/:customerId/upload/init", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const body = await c.req.json();

  const initSchema = z.object({
    filename: z.string(),
    mimeType: z.string(),
    totalSize: z.number().int().positive(),
  });

  const input = initSchema.parse(body);
  const result = await getService().initUpload(user.companyId!, customerId, user._id?.toString()!, input);

  return c.json(successResponse(result));
});

// POST /api/customers/:customerId/upload/chunk - Upload a chunk
customerImageRoutes.post("/:customerId/upload/chunk", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const uploadId = c.req.query("uploadId");
  const chunkIndex = c.req.query("index");

  if (!uploadId || !chunkIndex) {
    return c.json({ success: false, error: { message: "Missing uploadId or index" } }, 400);
  }

  // Get raw binary body
  const buffer = await c.req.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    return c.json({ success: false, error: { message: "Empty chunk data" } }, 400);
  }

  const result = await getService().uploadChunk(
    user.companyId!,
    uploadId,
    parseInt(chunkIndex),
    Buffer.from(buffer)
  );

  return c.json(successResponse(result));
});

// POST /api/customers/:customerId/upload/finalize - Finalize upload
customerImageRoutes.post("/:customerId/upload/finalize", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const body = await c.req.json();

  const finalizeSchema = z.object({
    uploadId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
  });

  const input = finalizeSchema.parse(body);
  const image = await getService().finalizeUpload(user.companyId!, input.uploadId, {
    title: input.title,
    description: input.description,
    labels: input.labels,
  });

  return c.json(successResponse(toResponse(image)), 201);
});

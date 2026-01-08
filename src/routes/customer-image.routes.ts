import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { CustomerImageService, type UploadImageInput } from "@/services/customer-image.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { toResponse, toResponseArray } from "@/utils/response-transformer";
import { z } from "zod";
import { Binary } from "mongodb";

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

// GET /api/customers/:customerId/images - List images for customer (metadata only)
customerImageRoutes.get("/:customerId/images", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");

  const images = await getService().listImagesByCustomer(user.companyId!, customerId);
  return c.json(successResponse(toResponseArray(images)));
});

// GET /api/customers/:customerId/images/:imageId - Get image metadata
customerImageRoutes.get("/:customerId/images/:imageId", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");

  const image = await getService().getImageMetadata(user.companyId!, imageId);
  return c.json(successResponse(toResponse(image)));
});

// GET /api/customers/:customerId/images/:imageId/download - Download image binary
customerImageRoutes.get("/:customerId/images/:imageId/download", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");

  const image = await getService().getImageData(user.companyId!, imageId);

  // Return binary data with correct content type
  const buffer = (image.data as Binary).buffer;
  return new Response(buffer, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": image.size.toString(),
      "Content-Disposition": `inline; filename="${image.filename}"`,
    },
  });
});

// POST /api/customers/:customerId/images - Upload image(s) via multipart/form-data
customerImageRoutes.post("/:customerId/images", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");

  const formData = await c.req.formData();
  const files = formData.getAll("files") as File[];
  const title = formData.get("title") as string || "Untitled";
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
      title: files.length === 1 ? title : file.name,
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
});

// PUT /api/customers/:customerId/images/:imageId - Update image metadata
customerImageRoutes.put("/:customerId/images/:imageId", async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");
  const body = await c.req.json();

  const updateSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
  });

  const input = updateSchema.parse(body);
  const image = await getService().updateImage(user.companyId!, imageId, input);

  return c.json(successResponse(toResponse(image)));
});

// DELETE /api/customers/:customerId/images/:imageId - Delete image
customerImageRoutes.delete("/:customerId/images/:imageId", async (c) => {
  const user = c.get("user");
  const customerId = c.req.param("customerId");
  const imageId = c.req.param("imageId");

  await getService().deleteImage(user.companyId!, customerId, imageId);

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

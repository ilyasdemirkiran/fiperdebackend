import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { VendorAttachmentService, type UploadAttachmentInput } from "@/services/vendor-attachment.service";
import { successResponse } from "@/utils/response";
import { authMiddleware } from "@/middleware/auth";
import { z } from "zod";
import { Binary } from "mongodb";

export const vendorAttachmentRoutes = new Hono<Env>();

let service: VendorAttachmentService | null = null;

function getService(): VendorAttachmentService {
  if (!service) {
    service = new VendorAttachmentService();
  }
  return service;
}

// Apply auth middleware
vendorAttachmentRoutes.use("*", authMiddleware);

// GET /api/vendors/:vendorId/attachments - List attachments for vendor (metadata only)
vendorAttachmentRoutes.get("/:vendorId/attachments", async (c) => {
  const vendorId = c.req.param("vendorId");

  const attachments = await getService().listAttachmentsByVendor(vendorId);

  return c.json(successResponse(attachments));
});

// GET /api/vendors/:vendorId/attachments/:attachmentId - Get attachment metadata
vendorAttachmentRoutes.get("/:vendorId/attachments/:attachmentId", async (c) => {
  const attachmentId = c.req.param("attachmentId");

  const attachment = await getService().getAttachmentMetadata(attachmentId);

  return c.json(successResponse(attachment));
});

// GET /api/vendors/:vendorId/attachments/:attachmentId/preview - Preview PDF (converts if necessary)
vendorAttachmentRoutes.get("/:vendorId/attachments/:attachmentId/preview", async (c) => {
  const attachmentId = c.req.param("attachmentId");

  const attachment = await getService().getAttachment(attachmentId);
  const binaryData = (attachment.data as Binary).buffer;
  let buffer = Buffer.from(binaryData);
  let mimeType = attachment.mimeType as string; // Assert string to use string methods
  let filename = attachment.filename;

  // If not PDF, convert
  if (mimeType !== "application/pdf") {
    const { DocumentConverter } = await import("@/utils/document-converter");

    try {
      if (mimeType.includes("sheet") || mimeType.includes("excel") || filename.endsWith(".xls") || filename.endsWith(".xlsx")) {
        const u8 = await DocumentConverter.excelToPdf(buffer);
        buffer = Buffer.from(u8);
        mimeType = "application/pdf";
      } else if (mimeType.includes("word") || mimeType.includes("document") || filename.endsWith(".doc") || filename.endsWith(".docx")) {
        const u8 = await DocumentConverter.docToPdf(buffer);
        buffer = Buffer.from(u8);
        mimeType = "application/pdf";
      }
    } catch (error) {
      console.error("Preview conversion failed", error);
      // If conversion fails, return original file but it might not preview well
    }
  }

  // Preview means inline usually, but since client wants data to show:
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf", // Force PDF content type for preview
      "Content-Length": buffer.length.toString(),
      "Content-Disposition": `inline; filename="${filename.replace(/\.[^/.]+$/, "")}.pdf"`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

// GET /api/vendors/:vendorId/attachments/:attachmentId/download - Download PDF
vendorAttachmentRoutes.get("/:vendorId/attachments/:attachmentId/download", async (c) => {
  const attachmentId = c.req.param("attachmentId");

  const attachment = await getService().getAttachment(attachmentId);

  // Return binary data with correct content type
  const buffer = (attachment.data as Binary).buffer;
  return new Response(buffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": attachment.size.toString(),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});


// POST /api/vendors/:vendorId/attachments - Upload PDF (sudo only)
vendorAttachmentRoutes.post("/:vendorId/attachments", async (c) => {
  const user = c.get("user");
  const vendorId = c.req.param("vendorId");

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string || "";

  if (!file) {
    return c.json({ success: false, error: { message: "No file provided" } }, 400);
  }

  if (!title) {
    return c.json({ success: false, error: { message: "Title is required" } }, 400);
  }

  const input: UploadAttachmentInput = {
    title,
    description,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  };

  const attachment = await getService().uploadAttachment(
    vendorId,
    user._id!.toString(),
    user.role,
    input
  );

  return c.json(successResponse(attachment), 201);
});

// PUT /api/vendors/:vendorId/attachments/:attachmentId - Update attachment metadata (sudo only)
vendorAttachmentRoutes.put("/:vendorId/attachments/:attachmentId", async (c) => {
  const user = c.get("user");
  const attachmentId = c.req.param("attachmentId");
  const body = await c.req.json();

  const updateSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  });

  const input = updateSchema.parse(body);
  const attachment = await getService().updateAttachment(attachmentId, user.role, input);

  return c.json(successResponse(attachment));
});

// DELETE /api/vendors/:vendorId/attachments/:attachmentId - Delete attachment (sudo only)
vendorAttachmentRoutes.delete("/:vendorId/attachments/:attachmentId", async (c) => {
  const user = c.get("user");
  const attachmentId = c.req.param("attachmentId");

  await getService().deleteAttachment(attachmentId, user.role);

  return c.json(successResponse({ message: "Attachment deleted successfully" }));
});

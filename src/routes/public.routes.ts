import { Hono } from "hono";
import { VendorAttachmentService } from "@/services/vendor-attachment.service";
import { Binary } from "mongodb";

export const publicRoutes = new Hono();

let attachmentService: VendorAttachmentService | null = null;

function getAttachmentService(): VendorAttachmentService {
  if (!attachmentService) {
    attachmentService = new VendorAttachmentService();
  }
  return attachmentService;
}

// GET /api/public/attachments/:attachmentId - Public attachment preview (no auth)
publicRoutes.get("/attachments/:attachmentId", async (c) => {
  const attachmentId = c.req.param("attachmentId");

  const attachment = await getAttachmentService().getAttachment(attachmentId);
  const binaryData = (attachment.data as Binary).buffer;
  const buffer = Buffer.from(binaryData);

  return new Response(buffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": buffer.length.toString(),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});

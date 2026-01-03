import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { Binary, ObjectId } from 'mongodb';

// Only PDF files are allowed
export const ALLOWED_ATTACHMENT_MIME_TYPE = 'application/pdf';

export const vendorAttachmentSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  uploadedAt: timestampSchema,
  uploaderId: z.string(),
  filename: z.string(),
  mimeType: z.literal('application/pdf'), // Only PDF allowed
  size: z.number(), // bytes
  data: z.custom<Binary>(), // Binary PDF data stored in MongoDB
});

export type VendorAttachment = z.infer<typeof vendorAttachmentSchema>;

// Response type without binary data (for listing)
export const vendorAttachmentMetadataSchema = vendorAttachmentSchema.omit({ data: true });
export type VendorAttachmentMetadata = z.infer<typeof vendorAttachmentMetadataSchema>;
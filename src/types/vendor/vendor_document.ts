import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { Binary, ObjectId } from 'mongodb';

// Allowed document types: PDF and Excel
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
] as const;

export const vendorDocumentSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.custom<ObjectId>(),
  title: z.string(),
  description: z.string().default(""),
  uploadedAt: timestampSchema,
  uploaderId: z.string(),
  uploaderName: z.string(),
  filename: z.string(),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  size: z.number(), // bytes
  data: z.custom<Binary>(), // Binary data stored in MongoDB
});

export type VendorDocument = z.infer<typeof vendorDocumentSchema>;

// Response type without binary data (for listing)
export const vendorDocumentMetadataSchema = vendorDocumentSchema.omit({ data: true });
export type VendorDocumentMetadata = z.infer<typeof vendorDocumentMetadataSchema>;

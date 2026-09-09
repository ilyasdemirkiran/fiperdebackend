import {z} from 'zod';
import {timestampSchema} from '@/types/timestamp';
import {Binary, ObjectId} from 'mongodb';
import {ALLOWED_DOCUMENT_MIME_TYPES} from '@/types/vendor/vendor_document';

export {ALLOWED_DOCUMENT_MIME_TYPES};

export const vendorAttachmentSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  uploadedAt: timestampSchema,
  uploaderId: z.string(),
  uploaderName: z.string().optional(),
  filename: z.string(),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  size: z.number(), // bytes
  data: z.custom<Binary>(), // Binary data stored in MongoDB
});

export type VendorAttachment = z.infer<typeof vendorAttachmentSchema>;

// Response type without binary data (for listing)
export const vendorAttachmentMetadataSchema = vendorAttachmentSchema.omit({data: true});
export type VendorAttachmentMetadata = z.infer<typeof vendorAttachmentMetadataSchema>;
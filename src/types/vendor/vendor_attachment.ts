import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';

export const vendorAttachmentSchema = z
  .object({
    id: z.string(),
    vendorId: z.string(),
    title: z.string(),
    description: z.string(),
    uploadedAt: timestampSchema,
    uploaderId: z.string(),
    name: z.string(),
    url: z.string(),
  });

export type VendorAttachment = z.infer<typeof vendorAttachmentSchema>;

export function getVendorAttachmentStoragePath(vendorId: string, fileName: string) {
  return `/vendors/${vendorId}/attachments/${fileName}`;
}
import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { Binary, ObjectId } from 'mongodb';

export const customerImageSchema = z
  .object({
    _id: z.custom<ObjectId>().optional(),
    customerId: z.string(),
    title: z.string(),
    description: z.string().default(""),
    uploadedAt: timestampSchema,
    uploaderId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(), // bytes
    data: z.custom<Binary>(), // Binary image data stored in MongoDB
    labels: z.array(z.string()).default([]),
  });

export type CustomerImage = z.infer<typeof customerImageSchema>;

// Response type without binary data (for listing)
export const customerImageMetadataSchema = customerImageSchema.omit({ data: true });
export type CustomerImageMetadata = z.infer<typeof customerImageMetadataSchema>;
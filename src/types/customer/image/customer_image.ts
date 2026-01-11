import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { ObjectId } from 'mongodb';

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
    fileId: z.custom<ObjectId>(), // GridFS file reference
    labels: z.array(z.string()).default([]),
  });

export type CustomerImage = z.infer<typeof customerImageSchema>;

// Response type without fileId (for listing)
export const customerImageMetadataSchema = customerImageSchema.omit({ fileId: true });
export type CustomerImageMetadata = z.infer<typeof customerImageMetadataSchema>;
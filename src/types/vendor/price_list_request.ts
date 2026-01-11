import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { Binary, ObjectId } from 'mongodb';

// Allowed file types for price list requests
export const PRICE_LIST_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
] as const;

// Embedded user info for easy access
const embeddedUserSchema = z.object({
  userId: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
});

export const priceListRequestSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorName: z.string().min(2, 'Tedarikçi adı en az 2 karakter olmalı'),
  status: z.enum(['pending', 'completed']),

  // File data
  filename: z.string(),
  mimeType: z.enum(PRICE_LIST_ALLOWED_MIME_TYPES),
  size: z.number(),
  data: z.custom<Binary>(),

  // Requesting user (embedded for easy access)
  requestedBy: embeddedUserSchema,
  requestedAt: timestampSchema,

  // Completing sudo user (set when completed)
  completedBy: embeddedUserSchema.optional(),
  completedAt: timestampSchema.optional(),
});

export type PriceListRequest = z.infer<typeof priceListRequestSchema>;

// Response type without binary data (for listing)
export const priceListRequestMetadataSchema = priceListRequestSchema.omit({ data: true });
export type PriceListRequestMetadata = z.infer<typeof priceListRequestMetadataSchema>;

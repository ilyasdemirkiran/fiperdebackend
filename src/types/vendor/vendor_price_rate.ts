import { z } from 'zod';
import { ObjectId } from 'mongodb';

export const vendorPriceRateSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.custom<ObjectId>(),
  rate: z.number().min(0).max(500).default(0),
});

export type VendorPriceRate = z.infer<typeof vendorPriceRateSchema>;
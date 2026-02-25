import { z } from 'zod';
import { phoneNumberSchema } from '@/types/phone_number';
import { isEmpty } from 'es-toolkit/compat';
import { timestampSchema } from '@/types/timestamp';
import { ObjectId } from 'mongodb';

// Base object schema without refinements
export const vendorPriceRateSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.custom<ObjectId>(),
  rate: z.number().min(0).max(100),
});

export type VendorPriceRate = z.infer<typeof vendorPriceRateSchema>;
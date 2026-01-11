import { z } from 'zod';
import { phoneNumberSchema } from '@/types/phone_number';
import { isEmpty } from 'es-toolkit/compat';
import { timestampSchema } from '@/types/timestamp';
import { ObjectId } from 'mongodb';

// Base object schema without refinements
export const vendorBaseSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  name: z.string().min(2, 'Min 2 Karakter').max(100),
  phone: phoneNumberSchema,
  city: z.string().min(2, 'Şehir seçilmelidir').max(100).optional(),
  district: z.string().min(2, 'İlçe seçilmelidir').optional(),
  address: z
    .string()
    .min(2, 'En az 2 karakter gereklidir')
    .max(1000, 'Max 1000 karakter')
    .optional(),
  pdfUrl: z.string().optional(),
  allowedCompanyIds: z.array(z.string()).default([]), // empty = all companies can see
  createdAt: timestampSchema
});

// Full schema with refinements
export const vendorSchema = vendorBaseSchema.superRefine((data, ctx) => {
  if (data.city && isEmpty(data.district)) {
    ctx.addIssue({
      code: 'custom',
      message: 'İlçe, şehir seçildiğinde zorunludur',
      path: ['district']
    });
  }
});

export type Vendor = z.infer<typeof vendorSchema>;
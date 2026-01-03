import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { ObjectId } from 'mongodb';

export const vendorPermissionSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.string(),
  companyId: z.string(),
  createdAt: timestampSchema,
});

export type VendorPermission = z.infer<typeof vendorPermissionSchema>;

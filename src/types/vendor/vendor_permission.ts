import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { ObjectId } from 'mongodb';

export const vendorPermissionSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  vendorId: z.custom<ObjectId>(),
  companyId: z.custom<ObjectId>(),
  createdAt: timestampSchema,
});

export type VendorPermission = z.infer<typeof vendorPermissionSchema>;

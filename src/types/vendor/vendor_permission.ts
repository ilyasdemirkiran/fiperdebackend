import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';

export const vendorPermissionSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  companyId: z.string(),
  createdAt: timestampSchema,
});

export type VendorPermission = z.infer<typeof vendorPermissionSchema>;

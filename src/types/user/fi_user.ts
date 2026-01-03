import { z } from 'zod';
import { timestampSchema } from '@/types/timestamp';
import { phoneNumberSchema } from '@/types/phone_number';
import { ObjectId } from 'mongodb';

export const userRoleSchema = z.enum(['sudo', 'admin', 'user']);

export const fiUserSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  phoneNumber: phoneNumberSchema,
  name: z.string().min(3, "En az 3 karakter gereklidir."),
  surname: z.string().min(2, "En az 2 karakter gereklidir."),
  companyId: z.string().optional(),
  role: userRoleSchema,
  createdAt: timestampSchema
});

export type FIUser = z.infer<typeof fiUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

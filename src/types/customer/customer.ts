import { z } from "zod";
import { phoneNumberSchema } from "@/types/phone_number";
import { isEmpty } from "es-toolkit/compat";
import { timestampSchema } from "@/types/timestamp";
import { ObjectId } from "mongodb";

export const customerStatusSchema = z.enum(["active", "inactive"]);

// Base object schema without refinements (for .omit() and .pick())
const customerBaseSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  status: customerStatusSchema.optional().transform((val) => val ?? "active"),
  name: z
    .string({ message: "Isim zorunludur" })
    .min(2, "En az 2 karakter")
    .max(100),
  surname: z
    .string({ message: "Soyisim zorunludur" })
    .min(2, "En az 2 karakter")
    .max(100),
  phone: phoneNumberSchema,
  city: z.string().min(1, "Şehir zorunludur."),
  district: z.string().min(1, "İlçe zorunludur."),
  address: z
    .string()
    .max(100, "En fazla 100 karakter")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? "" : val)),
  imageCount: z
    .number()
    .optional()
    .transform((val) => val ?? 0),
  createdAt: timestampSchema,
});

// Full schema with refinements
export const customerSchema = customerBaseSchema.superRefine((data, ctx) => {
  if (data.city && isEmpty(data.district)) {
    ctx.addIssue({
      code: "custom",
      message: "İlçe, şehir seçildiğinde zorunludur",
      path: ["district"],
    });
  }
});

export type Customer = z.infer<typeof customerSchema>;

export type CustomerStatus = z.infer<typeof customerStatusSchema>;

// Database type (alias for Customer)
export type CustomerDb = Customer;

// Input schemas for creating and updating customers (use base schema without refinements)
export const createCustomerSchema = customerBaseSchema.omit({
  _id: true,
  imageCount: true,
  createdAt: true,
});

export const updateCustomerSchema = customerBaseSchema
  .omit({
    _id: true,
    imageCount: true,
    createdAt: true,
  })
  .partial();

// Input types
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// Query schema for listing customers
export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: customerStatusSchema.optional(),
  search: z.string().optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

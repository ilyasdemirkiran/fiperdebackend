import { z } from "zod";
import { currencySchema } from "@/types/currency";
import { timestampSchema } from "@/types/timestamp";
import { vendorSchema } from "@/types/vendor/vendor";
import { ObjectId } from "mongodb";

export const productSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  name: z.string().min(2, "En az 2 karakter gereklidir.").max(100),
  code: z.string().min(2, "En az 2 karakter gereklidir.").max(100, "Max 100 karakter"),
  price: z.coerce.number<number>("Fiyat girmeniz gerekiyor.").positive({ error: "Positive olmak zorunda" }),
  currency: currencySchema,
  vendorId: z.custom<ObjectId>(),
  vendor: vendorSchema.optional(),
  vendorName: z.string().optional(),
  description: z.string().min(2, "Min 2 karakter").max(1000, "Max 1000 karakter").optional(),
  imageUrl: z.url().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});

export type Product = z.infer<typeof productSchema>;
import { z } from "zod";
import { phoneNumberSchema } from "@/types/phone_number";
import { isEmpty } from "es-toolkit/compat";
import { timestampSchema } from "@/types/timestamp";

export const customerStatusSchema = z.enum(["active", "inactive"]);

export const customerSchema = z
  .object({
    id: z.string(),
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
  })
  .superRefine((data, ctx) => {
    if (data.city && isEmpty(data.district)) {
      ctx.addIssue({
        code: "custom",
        message: "İlçe, şehir seçildiğinde zorunludur",
        path: ["district"],
      });
    }
  });

export type Customer = z.infer<typeof customerSchema>;

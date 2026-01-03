import { currencySchema } from "@/types/currency";
import { timestampSchema } from "@/types/timestamp";
import { z } from "zod";
import { ObjectId } from "mongodb";

export const paymentTypeSchema = z.enum([
  "cash",
  "bank_transfer",
  "credit_card",
  "check",
  "other",
]);

export const paymentLogSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  saleId: z
    .string({ message: "Satış ID'si zorunludur" })
    .min(1, "Satış ID'si boş olamaz"),
  customerId: z
    .string({ message: "Müşteri ID'si zorunludur" })
    .min(1, "Müşteri ID'si boş olamaz"),
  createdByUserId: z
    .string({ message: "Kullanıcı ID'si zorunludur" })
    .min(1, "Kullanıcı ID'si boş olamaz"),
  createdByUserName: z.string().nullable().optional(),
  amount: z.coerce
    .number<number>({ message: "Tutar zorunludur" })
    .positive("Tutar pozitif olmalıdır"),
  currency: currencySchema,
  paymentType: paymentTypeSchema,
  description: z.string().nullable().optional(),
  paymentDate: timestampSchema,
  createdAt: timestampSchema,
});

export type PaymentType = z.infer<typeof paymentTypeSchema>;
type PaymentLog = z.infer<typeof paymentLogSchema>;

export default PaymentLog;

import { z } from "zod";
import { currencySchema } from "@/types/currency";
import { paymentLogSchema } from "@/types/customer/sale/payment_log";
import { timestampSchema } from "@/types/timestamp";
import { ObjectId } from "mongodb";

export const saleStatusSchema = z.enum(["pending", "completed", "deleted"]);

export const saleSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  customerId: z
    .string({ message: "Müşteri ID'si zorunludur" })
    .min(1, "Müşteri ID'si boş olamaz"),
  createdByUserId: z
    .string({ message: "Kullanıcı ID'si zorunludur" })
    .min(1, "Kullanıcı ID'si boş olamaz"),
  createdByUserName: z.string().optional(),
  totalAmount: z.coerce
    .number<number>({ message: "Toplam tutar zorunludur" })
    .positive("Toplam tutar pozitif olmalıdır")
    .transform((val) => Math.round(val * 100) / 100),
  totalPaidAmount: z.coerce
    .number<number>({ message: "Ödenen tutar zorunludur" })
    .transform((val) => Math.round(val * 100) / 100),
  currency: currencySchema,
  status: saleStatusSchema,
  description: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  logs: z.array(paymentLogSchema),
});

export type SaleStatus = z.infer<typeof saleStatusSchema>;
export type Sale = z.infer<typeof saleSchema>;

export const addSaleSchema = saleSchema.pick({
  customerId: true,
  createdByUserId: true,
  createdByUserName: true,
  totalAmount: true,
  currency: true,
  status: true,
  description: true,
  logs: true,
  createdAt: true,
});
export type AddSale = z.infer<typeof addSaleSchema>;

export const updateSaleSchema = saleSchema.pick({
  currency: true,
  totalAmount: true,
  status: true,
  description: true,
  logs: true,
  createdAt: true,
});
export type UpdateSale = z.infer<typeof updateSaleSchema>;

export type DeleteSale = Pick<Sale, "_id">;

export const addPaymentLogSchema = paymentLogSchema.pick({
  amount: true,
  currency: true,
  paymentType: true,
  description: true,
}).extend({
  createdAt: timestampSchema.optional(),
});
export type AddPaymentLog = z.infer<typeof addPaymentLogSchema>;

export const updatePaymentLogSchema = paymentLogSchema.pick({
  _id: true,
  amount: true,
  currency: true,
  paymentType: true,
  description: true,
}).extend({
  createdAt: timestampSchema.optional(),
});
export type UpdatePaymentLog = z.infer<typeof updatePaymentLogSchema>;

export const deletePaymentLogSchema = paymentLogSchema.pick({
  _id: true,
});
export type DeletePaymentLog = z.infer<typeof deletePaymentLogSchema>;

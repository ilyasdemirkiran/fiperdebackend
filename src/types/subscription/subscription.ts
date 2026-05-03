import {z} from "zod";

export const subscriptionPlanSchema = z.enum(["monthly", "yearly"]);

export const subscriptionStatusSchema = z.enum([
  "active", // Aktif odeme yapilmis abonelik
  "expired", // Abonelik suresi doldu
  "cancelled", // Abonelik iptal edildi
]);

export const subscriptionSchema = z.object({
  _id: z.string().optional(),
  companyId: z.string(),
  status: subscriptionStatusSchema,

  // Plan Bilgisi
  plan: subscriptionPlanSchema,

  // Paytr Ödeme Bilgisi
  paytrMerchantOid: z.string(),
  paytrPaymentAmount: z.number(),

  subscriptionStartDate: z.date(),
  subscriptionEndDate: z.date(),

  createdAt: z.date(),
});

export const subscriptionInfoSchema = z.object({
  status: subscriptionStatusSchema,
  plan: subscriptionPlanSchema,
  expiresAt: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
export type SubscriptionInfo = z.infer<typeof subscriptionInfoSchema>;
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;


import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";

export const subscriptionStatusSchema = z.enum(['trial', 'active', 'expired', 'none', 'cancelled']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  status: subscriptionStatusSchema,
  productId: z.string().optional(), // App Store Product ID
  transactionId: z.string().optional(), // App Store Transaction ID
  originalTransactionId: z.string().optional(), // Original purchase transaction
  receiptData: z.string().optional(), // Purchase receipt for verification
  expiresDate: z.custom<Timestamp>().optional(), // Auto-renewable subscription expiry
  trialStartDate: z.custom<Timestamp>().optional(),
  trialEndDate: z.custom<Timestamp>().optional(),
  subscriptionStartDate: z.custom<Timestamp>().optional(),
  subscriptionEndDate: z.custom<Timestamp>().optional(),
  price: z.number().default(1999), // 1.999 TL in kuruş
  originalPrice: z.number().default(2999), // 2.999 TL in kuruş
  cancelledAt: z.custom<Timestamp>().optional(), // When subscription was cancelled
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>().optional(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  trialDaysRemaining?: number;
  isTrialActive: boolean;
  price: number;
  originalPrice: number;
  discount: number;
}

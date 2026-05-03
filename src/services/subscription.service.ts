import {SubscriptionRepository} from "@/repositories/subscription.repository";
import type {FIUser} from "@/types/user/fi_user";
import {AppError} from "@/middleware/error-handler";
import type {Subscription, SubscriptionInfo, SubscriptionPlan} from "@/types/subscription/subscription";
import {addDays} from "date-fns/addDays";

export class SubscriptionService {

  private subscriptionRepo: SubscriptionRepository;

  constructor() {
    this.subscriptionRepo = new SubscriptionRepository();
  }

  async getSubscription(companyId: string): Promise<Subscription | null> {
    return await this.subscriptionRepo.findByCompanyId(companyId);
  }

  async renewSubscription(subscription: Pick<Subscription, "companyId" | "paytrMerchantOid" | "paytrPaymentAmount">): Promise<void> {
    const subscriptionFromDb = await this.getSubscription(subscription.companyId);

    if (subscriptionFromDb) {
      throw new AppError(400, "Subscription already exists", "SUBSCRIPTION_EXISTS")
    } else {
      const plan: SubscriptionPlan = subscription.paytrPaymentAmount > 1800 ? "yearly" : "monthly";
      const now = new Date();

      await this.subscriptionRepo.create({
        companyId: subscription.companyId,
        paytrMerchantOid: subscription.paytrMerchantOid,
        paytrPaymentAmount: subscription.paytrPaymentAmount,
        plan,
        subscriptionStartDate: now,
        subscriptionEndDate: addDays(now, plan === "yearly" ? 365 : 30),
        status: "active",
        createdAt: now,
      });
    }
  }

  async getInfo(user: FIUser): Promise<SubscriptionInfo | null> {
    if (!user.companyId) {
      throw new AppError(400, "Company ID not found", "COMPANY_ID_NOT_FOUND")
    }

    const subscription = await this.subscriptionRepo.findByCompanyId(user.companyId);

    if (!subscription) {
      return null;
    }

    const now = new Date();
    const isExpired = subscription.subscriptionEndDate < now;

    if (isExpired && subscription.status !== "expired") {
      // Abonelik süresi dolmuş ancak durum hala active ise, durumu expired olarak güncelle
      await this.subscriptionRepo.delete(user.companyId); // Eski kaydı sil
    }

    return {
      status: isExpired ? "expired" : subscription.status,
      plan: subscription.plan,
      expiresAt: subscription.subscriptionEndDate,
    };
  }

}
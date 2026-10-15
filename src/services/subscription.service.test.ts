import { describe, expect, it, mock, beforeEach } from "bun:test";
import { SubscriptionService } from "./subscription.service";
import { AppError } from "@/middleware/error-handler";
import type { SubscriptionRepository } from "@/repositories/subscription.repository";
import type { Subscription } from "@/types/subscription/subscription";
import type { FIUser } from "@/types/user/fi_user";
import { addDays } from "date-fns/addDays";

describe("SubscriptionService Unit Tests", () => {
  let subscriptionService: SubscriptionService;
  let mockSubscriptionRepo: Partial<SubscriptionRepository>;

  const companyId = "comp-1";

  beforeEach(() => {
    mockSubscriptionRepo = {
      findByCompanyId: mock(),
      create: mock(),
      delete: mock(),
    };

    subscriptionService = new SubscriptionService(
      mockSubscriptionRepo as SubscriptionRepository
    );
  });

  describe("renewSubscription", () => {
    it("should throw AppError(400) if active subscription already exists", async () => {
      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue({
        companyId,
        status: "active",
      });

      expect(
        subscriptionService.renewSubscription({
          companyId,
          paytrMerchantOid: "oid-123",
          paytrPaymentAmount: 50000,
        })
      ).rejects.toThrow(new AppError(400, "Subscription already exists", "SUBSCRIPTION_EXISTS"));
      expect(mockSubscriptionRepo.create).not.toHaveBeenCalled();
    });

    it("should create monthly subscription (30 days) when amount <= 200000", async () => {
      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue(null);
      (mockSubscriptionRepo.create as any).mockResolvedValue(undefined);

      await subscriptionService.renewSubscription({
        companyId,
        paytrMerchantOid: "oid-1",
        paytrPaymentAmount: 50000,
      });

      expect(mockSubscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          plan: "monthly",
          status: "active",
        })
      );
    });

    it("should create yearly subscription (365 days) when amount > 200000", async () => {
      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue(null);
      (mockSubscriptionRepo.create as any).mockResolvedValue(undefined);

      await subscriptionService.renewSubscription({
        companyId,
        paytrMerchantOid: "oid-2",
        paytrPaymentAmount: 250000,
      });

      expect(mockSubscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          plan: "yearly",
          status: "active",
        })
      );
    });
  });

  describe("getInfo", () => {
    it("should throw AppError(400) if user has no companyId", async () => {
      const userWithoutCompany: FIUser = {
        _id: "user-1",
      } as any;

      expect(subscriptionService.getInfo(userWithoutCompany)).rejects.toThrow(
        new AppError(400, "Company ID not found", "COMPANY_ID_NOT_FOUND")
      );
    });

    it("should return null if company has no subscription record", async () => {
      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue(null);

      const result = await subscriptionService.getInfo({ _id: "u1", companyId } as any);
      expect(result).toBeNull();
    });

    it("should detect expired subscription and delete stale record", async () => {
      const expiredDate = addDays(new Date(), -5); // 5 days ago
      const expiredSub: Subscription = {
        companyId,
        plan: "monthly",
        paytrMerchantOid: "oid",
        paytrPaymentAmount: 1000,
        status: "active", // expired date but still marked active
        subscriptionStartDate: addDays(expiredDate, -30),
        subscriptionEndDate: expiredDate,
        createdAt: new Date(),
      };

      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue(expiredSub);
      (mockSubscriptionRepo.delete as any).mockResolvedValue(true);

      const result = await subscriptionService.getInfo({ _id: "u1", companyId } as any);

      expect(mockSubscriptionRepo.delete).toHaveBeenCalledWith(companyId);
      expect(result?.status).toBe("expired");
    });
  });
});

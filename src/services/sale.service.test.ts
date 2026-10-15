import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { SaleService } from "./sale.service";
import { AppError } from "@/middleware/error-handler";
import type { SaleRepository } from "@/repositories/sale.repository";
import type { Sale } from "@/types/customer/sale/sale";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("SaleService Unit Tests", () => {
  let saleService: SaleService;
  let mockSaleRepo: Partial<SaleRepository>;

  const companyId = "comp-1";
  const saleId = "sale-100";
  const customerId = "cust-100";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockSaleRepo = {
      create: mock(),
      findById: mock(),
      findByCustomerId: mock(),
      update: mock(),
      delete: mock(),
      exists: mock(),
      addPaymentLog: mock(),
      updatePaymentLog: mock(),
      deletePaymentLog: mock(),
    };

    saleService = new SaleService(mockSaleRepo as SaleRepository);
  });

  describe("createSale (Status calculation & Role check)", () => {
    it("should throw AppError(403) if user is not admin or sudo", async () => {
      expect(
        saleService.createSale(companyId, "u1", "Ali", "user", {
          customerId,
          createdByUserId: "u1",
          totalAmount: 1000,
          currency: "TRY",
          status: "pending",
          createdAt: Timestamp.now(),
          logs: [],
        })
      ).rejects.toThrow(new AppError(403, "Only admin users can perform this operation", "FORBIDDEN"));
    });

    it("should calculate status as 'pending' when totalPaidAmount < totalAmount", async () => {
      (mockSaleRepo.create as any).mockImplementation((_cid: string, sale: any) =>
        Promise.resolve({ ...sale, _id: new ObjectId() })
      );

      const result = await saleService.createSale(companyId, "admin-1", "Admin", "admin", {
        customerId,
        createdByUserId: "admin-1",
        createdByUserName: "Admin",
        totalAmount: 5000,
        currency: "TRY",
        status: "pending",
        createdAt: Timestamp.now(),
        logs: [],
      });

      expect(result.status).toBe("pending");
      expect(result.totalPaidAmount).toBe(0);
      expect(result.totalAmount).toBe(5000);
    });

    it("should calculate status as 'completed' when totalPaidAmount >= totalAmount", async () => {
      (mockSaleRepo.create as any).mockImplementation((_cid: string, sale: any) =>
        Promise.resolve({ ...sale, _id: new ObjectId() })
      );

      const result = await saleService.createSale(companyId, "admin-1", "Admin", "admin", {
        customerId,
        createdByUserId: "admin-1",
        createdByUserName: "Admin",
        totalAmount: 3000,
        currency: "TRY",
        status: "pending",
        createdAt: Timestamp.now(),
        logs: [
          {
            saleId: "sale-1",
            customerId,
            createdByUserId: "admin-1",
            amount: 3000,
            currency: "TRY",
            paymentType: "credit_card",
            paymentDate: Timestamp.now(),
            createdAt: Timestamp.now(),
          },
        ],
      });

      expect(result.status).toBe("completed");
      expect(result.totalPaidAmount).toBe(3000);
    });
  });

  describe("updateSale", () => {
    it("should recalculate status if totalAmount is changed", async () => {
      const existingSale: Sale = {
        _id: new ObjectId(),
        customerId,
        createdByUserId: "u1",
        createdByUserName: "Admin",
        totalAmount: 4000,
        totalPaidAmount: 3000,
        currency: "TRY",
        status: "pending",
        createdAt: Timestamp.now(),
        logs: [],
      };

      (mockSaleRepo.findById as any).mockResolvedValue(existingSale);
      (mockSaleRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) =>
        Promise.resolve({ ...existingSale, ...updates })
      );

      // Lowering totalAmount to 3000 should switch status to completed
      const result = await saleService.updateSale(companyId, saleId, "admin", {
        totalAmount: 3000,
      });

      expect(result.status).toBe("completed");
    });
  });

  describe("Payment Logs (addPaymentLog)", () => {
    it("should throw AppError(404) if sale does not exist when adding payment log", async () => {
      (mockSaleRepo.findById as any).mockResolvedValue(null);

      expect(
        saleService.addPaymentLog(companyId, "missing", "admin-1", "Admin", "admin", {
          amount: 500,
          currency: "TRY",
          paymentType: "cash",
        })
      ).rejects.toThrow(new AppError(404, "Sale not found", "SALE_NOT_FOUND"));
    });

    it("should successfully add payment log", async () => {
      const existingSale: Sale = {
        _id: new ObjectId(),
        customerId,
        createdByUserId: "u1",
        createdByUserName: "Admin",
        totalAmount: 2000,
        totalPaidAmount: 0,
        currency: "TRY",
        status: "pending",
        createdAt: Timestamp.now(),
        logs: [],
      };
      (mockSaleRepo.findById as any).mockResolvedValue(existingSale);
      (mockSaleRepo.addPaymentLog as any).mockImplementation((_cid: string, _sid: string, log: any) =>
        Promise.resolve({
          ...existingSale,
          totalPaidAmount: log.amount,
          logs: [log],
        })
      );

      const result = await saleService.addPaymentLog(companyId, saleId, "admin-1", "Admin", "admin", {
        amount: 500,
        currency: "TRY",
        paymentType: "cash",
        description: "Peşinat",
      });

      expect(mockSaleRepo.addPaymentLog).toHaveBeenCalled();
      expect(result.logs.length).toBe(1);
    });
  });
});

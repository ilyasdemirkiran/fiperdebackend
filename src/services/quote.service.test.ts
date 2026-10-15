import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { QuoteService } from "./quote.service";
import { AppError } from "@/middleware/error-handler";
import type { QuoteRepository } from "@/repositories/quote.repository";
import type { ProductRepository } from "@/repositories/product.repository";
import type { CustomerService } from "@/services/customer.service";
import type { QuoteItemLabelRepository } from "@/repositories/quote-item-label.repository";
import type { Quote } from "@/types/quotes/quote";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("QuoteService Unit Tests", () => {
  let quoteService: QuoteService;
  let mockQuoteRepo: Partial<QuoteRepository>;
  let mockProductRepo: Partial<ProductRepository>;
  let mockCustomerService: Partial<CustomerService>;
  let mockLabelRepo: Partial<QuoteItemLabelRepository>;

  const companyId = "comp-1";
  const quoteId = "quote-1";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockQuoteRepo = {
      getNextQuoteNumber: mock(),
      create: mock(),
      findById: mock(),
      findAll: mock(),
      update: mock(),
      delete: mock(),
    };

    mockProductRepo = {
      findById: mock(),
    };

    mockCustomerService = {
      getCustomer: mock(),
      createCustomer: mock(),
    };

    mockLabelRepo = {
      create: mock(),
      findAll: mock(),
      update: mock(),
      delete: mock(),
    };

    quoteService = new QuoteService(
      mockQuoteRepo as QuoteRepository,
      mockProductRepo as ProductRepository,
      mockCustomerService as CustomerService,
      mockLabelRepo as QuoteItemLabelRepository
    );
  });

  describe("createQuote", () => {
    it("should successfully generate next quote number and create draft quote", async () => {
      (mockQuoteRepo.getNextQuoteNumber as any).mockResolvedValue("QT-2026-0001");
      (mockQuoteRepo.create as any).mockImplementation((_cid: string, q: Quote) => Promise.resolve(q));

      const conversions = { TRY: 1, USD: 35, EUR: 38 };
      const result = await quoteService.createQuote(
        companyId,
        "user-1",
        "Ahmet Demir",
        "TRY",
        conversions
      );

      expect(mockQuoteRepo.getNextQuoteNumber).toHaveBeenCalledWith(companyId);
      expect(result.quoteNumber).toBe("QT-2026-0001");
      expect(result.status).toBe("draft");
      expect(result.creatorId).toBe("user-1");
      expect(result.creatorName).toBe("Ahmet Demir");
      expect(result.currency).toBe("TRY");
      expect(result.rooms).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getQuote & Status Restrictions (ensureEditable)", () => {
    it("should throw AppError(404) if quote is not found", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue(null);

      expect(quoteService.getQuote(companyId, "non-existent")).rejects.toThrow(
        new AppError(404, "Quote not found", "QUOTE_NOT_FOUND")
      );
    });

    it("should prevent modification if quote is approved or denied", async () => {
      const approvedQuote: Quote = {
        _id: new ObjectId(),
        companyId,
        quoteNumber: "QT-2026-0001",
        creatorId: "user-1",
        currency: "TRY",
        conversions: { TRY: 1, USD: 35, EUR: 38 },
        rooms: [],
        status: "approved",
        total: 1000,
        discountPercent: 0,
        totalAfterDiscount: 1000,
        createdAt: Timestamp.now(),
      };
      (mockQuoteRepo.findById as any).mockResolvedValue(approvedQuote);

      // Attempting to add a room to an approved quote
      expect(quoteService.addRoom(companyId, quoteId, "Salon")).rejects.toThrow(
        new AppError(400, "Approved or Denied quotes cannot be edited.", "READ_ONLY_ERROR")
      );
    });
  });

  describe("updateQuoteCustomer", () => {
    const baseQuote: Quote = {
      _id: new ObjectId(),
      companyId,
      quoteNumber: "QT-2026-0001",
      creatorId: "user-1",
      currency: "TRY",
      conversions: { TRY: 1, USD: 30, EUR: 35 },
      rooms: [],
      status: "draft",
      total: 0,
      discountPercent: 0,
      totalAfterDiscount: 0,
      createdAt: Timestamp.now(),
    };

    it("should update with existing customer if customerId provided", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue(baseQuote);
      (mockCustomerService.getCustomer as any).mockResolvedValue({
        _id: new ObjectId("507f1f77bcf86cd799439011"),
        name: "Merve",
        surname: "Kaya",
      });
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) =>
        Promise.resolve({ ...baseQuote, ...updates })
      );

      const result = await quoteService.updateQuoteCustomer(companyId, quoteId, {
        customerId: "507f1f77bcf86cd799439011",
      });

      expect(mockCustomerService.getCustomer).toHaveBeenCalledWith(companyId, "507f1f77bcf86cd799439011");
      expect(result.customerName).toBe("Merve Kaya");
    });

    it("should create new customer if newCustomer payload provided", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue(baseQuote);
      const createdCustId = new ObjectId();
      (mockCustomerService.createCustomer as any).mockResolvedValue({
        _id: createdCustId,
        name: "Kemal",
        surname: "Can",
      });
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) =>
        Promise.resolve({ ...baseQuote, ...updates })
      );

      const result = await quoteService.updateQuoteCustomer(companyId, quoteId, {
        newCustomer: { name: "Kemal", surname: "Can" },
      });

      expect(mockCustomerService.createCustomer).toHaveBeenCalled();
      expect(result.customerName).toBe("Kemal Can");
    });
  });

  describe("Currency and Conversion Calculations", () => {
    it("should update quote conversions and recalculate item and grand totals", async () => {
      const quoteWithItems: Quote = {
        _id: new ObjectId(),
        companyId,
        quoteNumber: "QT-2026-0001",
        creatorId: "user-1",
        currency: "TRY",
        conversions: { TRY: 1, USD: 30, EUR: 35 },
        rooms: [
          {
            id: "room-1",
            name: "Yatak Odası",
            items: [
              {
                id: "item-1",
                name: "İthal Perde",
                publicName: "",
                quantity: 2,
                unitPrice: 100, // 100 USD
                originalCurrency: "USD",
                convertedUnitPrice: 3000,
                discountAmount: 0,
                totalPrice: 6000,
              },
            ],
            total: 6000,
          },
        ],
        status: "draft",
        total: 6000,
        discountPercent: 10,
        totalAfterDiscount: 5400,
        createdAt: Timestamp.now(),
      };

      (mockQuoteRepo.findById as any).mockResolvedValue(quoteWithItems);
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) => {
        Object.assign(quoteWithItems, updates);
        return Promise.resolve(quoteWithItems);
      });

      // USD rate increases from 30 to 40
      const result = await quoteService.updateQuoteConversions(companyId, quoteId, {
        USD: 40,
        EUR: 42,
      });

      // 2 qty * (100 * 40) = 8000 TRY
      expect(result.rooms[0]!.items[0]!.convertedUnitPrice).toBe(4000);
      expect(result.rooms[0]!.items[0]!.totalPrice).toBe(8000);
      expect(result.rooms[0]!.total).toBe(8000);
      expect(result.total).toBe(8000);
      // 10% discount: 8000 * 0.9 = 7200
      expect(result.totalAfterDiscount).toBe(7200);
    });
  });

  describe("Quote Item Discounts (Percentage & Amount)", () => {
    it("should correctly apply percentage discount to item", async () => {
      const quote: Quote = {
        _id: new ObjectId(),
        companyId,
        quoteNumber: "QT-2026-0001",
        creatorId: "user-1",
        currency: "TRY",
        conversions: { TRY: 1, USD: 30, EUR: 35 },
        rooms: [
          {
            id: "room-1",
            name: "Salon",
            items: [
              {
                id: "item-1",
                name: "Kumaş",
                publicName: "",
                quantity: 5,
                unitPrice: 200, // 200 TRY each = 1000 TRY raw
                originalCurrency: "TRY",
                convertedUnitPrice: 200,
                discountAmount: 0,
                totalPrice: 1000,
              },
            ],
            total: 1000,
          },
        ],
        status: "draft",
        total: 1000,
        discountPercent: 0,
        totalAfterDiscount: 1000,
        createdAt: Timestamp.now(),
      };

      (mockQuoteRepo.findById as any).mockResolvedValue(quote);
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) => {
        Object.assign(quote, updates);
        return Promise.resolve(quote);
      });

      // Apply 20% discount on item
      const result = await quoteService.updateItem(companyId, quoteId, "room-1", "item-1", {
        discountType: "percentage",
        discountValue: 20,
      });

      const updatedItem = result.rooms[0]!.items[0]!;
      expect(updatedItem.discountType).toBe("percentage");
      expect(updatedItem.discountValue).toBe(20);
      expect(updatedItem.discountAmount).toBe(200); // 1000 * 0.20 = 200
      expect(updatedItem.totalPrice).toBe(800);      // 1000 - 200 = 800
      expect(result.rooms[0]!.total).toBe(800);
      expect(result.total).toBe(800);
    });

    it("should correctly apply amount (per-unit) discount in foreign currency", async () => {
      const quote: Quote = {
        _id: new ObjectId(),
        companyId,
        quoteNumber: "QT-2026-0001",
        creatorId: "user-1",
        currency: "TRY",
        conversions: { TRY: 1, USD: 30, EUR: 35 },
        rooms: [
          {
            id: "room-1",
            name: "Salon",
            items: [
              {
                id: "item-1",
                name: "Motorlu Mekanizma",
                publicName: "",
                quantity: 3,
                unitPrice: 100, // 100 USD each
                originalCurrency: "USD",
                convertedUnitPrice: 3000, // 3000 TRY each, rawTotal = 9000 TRY
                discountAmount: 0,
                totalPrice: 9000,
              },
            ],
            total: 9000,
          },
        ],
        status: "draft",
        total: 9000,
        discountPercent: 0,
        totalAfterDiscount: 9000,
        createdAt: Timestamp.now(),
      };

      (mockQuoteRepo.findById as any).mockResolvedValue(quote);
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) => {
        Object.assign(quote, updates);
        return Promise.resolve(quote);
      });

      // Apply 10 USD per-unit discount: 10 USD * 30 TRY = 300 TRY per unit. 3 qty * 300 = 900 TRY discount
      const result = await quoteService.updateItem(companyId, quoteId, "room-1", "item-1", {
        discountType: "amount",
        discountValue: 10,
      });

      const updatedItem = result.rooms[0]!.items[0]!;
      expect(updatedItem.discountType).toBe("amount");
      expect(updatedItem.discountValue).toBe(10);
      expect(updatedItem.discountAmount).toBe(900); // 3 * (10 * 30) = 900
      expect(updatedItem.totalPrice).toBe(8100);     // 9000 - 900 = 8100
      expect(result.total).toBe(8100);
    });

    it("should clear discount when discountType is null or discountValue is 0", async () => {
      const quoteWithDiscount: Quote = {
        _id: new ObjectId(),
        companyId,
        quoteNumber: "QT-2026-0001",
        creatorId: "user-1",
        currency: "TRY",
        conversions: { TRY: 1, USD: 30, EUR: 35 },
        rooms: [
          {
            id: "room-1",
            name: "Salon",
            items: [
              {
                id: "item-1",
                name: "Perde",
                publicName: "",
                quantity: 2,
                unitPrice: 500,
                originalCurrency: "TRY",
                convertedUnitPrice: 500,
                discountType: "percentage",
                discountValue: 50,
                discountAmount: 500,
                totalPrice: 500,
              },
            ],
            total: 500,
          },
        ],
        status: "draft",
        total: 500,
        discountPercent: 0,
        totalAfterDiscount: 500,
        createdAt: Timestamp.now(),
      };

      (mockQuoteRepo.findById as any).mockResolvedValue(quoteWithDiscount);
      (mockQuoteRepo.update as any).mockImplementation((_cid: string, _id: string, updates: any) => {
        Object.assign(quoteWithDiscount, updates);
        return Promise.resolve(quoteWithDiscount);
      });

      const result = await quoteService.updateItem(companyId, quoteId, "room-1", "item-1", {
        discountType: null,
        discountValue: null,
      });

      const updatedItem = result.rooms[0]!.items[0]!;
      expect(updatedItem.discountType).toBeUndefined();
      expect(updatedItem.discountValue).toBeUndefined();
      expect(updatedItem.discountAmount).toBe(0);
      expect(updatedItem.totalPrice).toBe(1000);
      expect(result.total).toBe(1000);
    });
  });

  describe("Workflow: submitForApproval, approveQuote, denyQuote", () => {
    it("should throw AppError if customer is missing when submitting for approval", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue({
        status: "draft",
        customerId: undefined,
        rooms: [{ items: [{ id: "1" }] }],
        total: 500,
      });

      expect(quoteService.submitForApproval(companyId, quoteId)).rejects.toThrow(
        new AppError(400, "Customer must be selected before submitting for approval.", "VALIDATION_ERROR")
      );
    });

    it("should throw AppError if total is 0 or no rooms/items when submitting", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue({
        status: "draft",
        customerId: new ObjectId(),
        rooms: [],
        total: 0,
      });

      expect(quoteService.submitForApproval(companyId, quoteId)).rejects.toThrow(
        new AppError(400, "Quote must have at least one room with at least one product.", "VALIDATION_ERROR")
      );
    });

    it("should allow approving only quotes in 'sent_for_approval' status", async () => {
      (mockQuoteRepo.findById as any).mockResolvedValue({
        status: "draft", // not sent_for_approval
      });

      expect(quoteService.approveQuote(companyId, quoteId)).rejects.toThrow(
        new AppError(400, "Only quotes sent for approval can be approved.", "INVALID_STATUS")
      );

      (mockQuoteRepo.findById as any).mockResolvedValue({
        status: "sent_for_approval",
      });
      (mockQuoteRepo.update as any).mockResolvedValue({
        status: "approved",
      });

      const approved = await quoteService.approveQuote(companyId, quoteId);
      expect(approved.status).toBe("approved");
    });
  });

  describe("Quote Item Labels", () => {
    it("should manage labels (add, list, update, delete)", async () => {
      (mockLabelRepo.create as any).mockResolvedValue({ id: "label-1", name: "Tül" });
      (mockLabelRepo.findAll as any).mockResolvedValue([{ id: "label-1", name: "Tül" }]);
      (mockLabelRepo.update as any).mockResolvedValue({ id: "label-1", name: "Güneşlik" });
      (mockLabelRepo.delete as any).mockResolvedValue(undefined);

      const created = await quoteService.addQuoteItemLabel(companyId, "Tül");
      expect(created.name).toBe("Tül");

      const list = await quoteService.listQuoteItemLabels(companyId);
      expect(list.length).toBe(1);

      const updated = await quoteService.updateQuoteItemLabel(companyId, "label-1", "Güneşlik");
      expect(updated.name).toBe("Güneşlik");

      await expect(quoteService.deleteQuoteItemLabel(companyId, "label-1")).resolves.toBeUndefined();
    });
  });
});

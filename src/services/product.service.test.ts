import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { ProductService } from "./product.service";
import { AppError } from "@/middleware/error-handler";
import type { ProductRepository } from "@/repositories/product.repository";
import type { VendorRepository } from "@/repositories/vendor.repository";
import type { VendorPriceRateRepository } from "@/repositories/vendor-price-rate.repository";
import type { Product } from "@/types/vendor/product/product";
import type { Vendor } from "@/types/vendor/vendor";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("ProductService Unit Tests", () => {
  let productService: ProductService;
  let mockProductRepo: Partial<ProductRepository>;
  let mockVendorRepo: Partial<VendorRepository>;
  let mockPriceRateRepo: Partial<VendorPriceRateRepository>;

  const companyId = "comp-1";
  const productId = "507f1f77bcf86cd799439011";
  const vendorId = "507f191e810c19729de860ea";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockProductRepo = {
      findEnrichedAll: mock(),
      findAll: mock(),
      findEnrichedById: mock(),
      findByVendorId: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
      exists: mock(),
    };

    mockVendorRepo = {
      findAll: mock(),
      findById: mock(),
    };

    mockPriceRateRepo = {
      findByVendorIds: mock(),
    };

    productService = new ProductService(
      mockProductRepo as ProductRepository,
      mockVendorRepo as VendorRepository,
      mockPriceRateRepo as VendorPriceRateRepository
    );
  });

  describe("listProductsForCompany & Price Rates", () => {
    it("should return empty list if no products exist", async () => {
      (mockProductRepo.findEnrichedAll as any).mockResolvedValue([]);
      (mockVendorRepo.findAll as any).mockResolvedValue([]);

      const result = await productService.listProductsForCompany(companyId);
      expect(result).toEqual([]);
    });

    it("should calculate priceWithRate correctly using vendor price rates", async () => {
      const vendorObjectId = new ObjectId(vendorId);
      const mockProducts: Product[] = [
        {
          _id: new ObjectId(),
          name: "Kadife Perde",
          code: "KD-01",
          price: 1000,
          currency: "TRY",
          vendorId: vendorObjectId,
          createdAt: Timestamp.now(),
        },
      ];

      const mockVendors: Vendor[] = [
        {
          _id: vendorObjectId,
          name: "Taç",
          createdAt: Timestamp.now(),
        },
      ];

      (mockProductRepo.findEnrichedAll as any).mockResolvedValue(mockProducts);
      (mockVendorRepo.findAll as any).mockResolvedValue(mockVendors);
      // Rate is 25% (vendor price rate)
      (mockPriceRateRepo.findByVendorIds as any).mockResolvedValue([
        { vendorId: vendorObjectId, rate: 25 },
      ]);

      const result = await productService.listProductsForCompany(companyId);

      expect(result.length).toBe(1);
      // 1000 * (1 + 25/100) = 1250
      expect((result[0] as any).priceWithRate).toBe(1250);
    });
  });

  describe("createProduct", () => {
    it("should create product without vendorId successfully", async () => {
      const productToCreate = {
        name: "Stor Perde",
        code: "ST-01",
        price: 500,
        currency: "TRY" as const,
      };

      (mockProductRepo.create as any).mockImplementation((data: any) =>
        Promise.resolve({ ...data, _id: new ObjectId() })
      );

      const result = await productService.createProduct(companyId, productToCreate);

      expect(mockProductRepo.create).toHaveBeenCalled();
      expect(result.name).toBe("Stor Perde");
      expect(result.vendorName).toBeUndefined();
    });

    it("should throw AppError(404) if vendorId is specified but vendor does not exist", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(
        productService.createProduct(companyId, {
          name: "Stor Perde",
          code: "ST-01",
          price: 500,
          currency: "TRY",
          vendorId: "non-existent-vendor",
        })
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
      expect(mockProductRepo.create).not.toHaveBeenCalled();
    });

    it("should set vendorName when vendor exists and create product", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(vendorId),
        name: "Zorlu Tekstil",
      });
      (mockProductRepo.create as any).mockImplementation((data: any) =>
        Promise.resolve({ ...data, _id: new ObjectId() })
      );

      const result = await productService.createProduct(companyId, {
        name: "Zebra Perde",
        code: "ZB-01",
        price: 750,
        currency: "TRY",
        vendorId,
      });

      expect(result.vendorName).toBe("Zorlu Tekstil");
    });
  });

  describe("getProduct", () => {
    it("should return product with calculated rate if product exists", async () => {
      const vendorObjectId = new ObjectId(vendorId);
      const mockProduct: Product = {
        _id: new ObjectId(productId),
        name: "Blackout Perde",
        code: "BO-01",
        price: 800,
        currency: "TRY",
        vendorId: vendorObjectId,
        createdAt: Timestamp.now(),
      };

      (mockProductRepo.findEnrichedById as any).mockResolvedValue(mockProduct);
      (mockPriceRateRepo.findByVendorIds as any).mockResolvedValue([
        { vendorId: vendorObjectId, rate: 10 },
      ]);

      const result = await productService.getProduct(companyId, productId);

      expect(result.name).toBe("Blackout Perde");
      // 800 * 1.10 = 880
      expect((result as any).priceWithRate).toBe(880);
    });

    it("should throw AppError(404) if product is not found", async () => {
      (mockProductRepo.findEnrichedById as any).mockResolvedValue(null);

      expect(productService.getProduct(companyId, "missing-id")).rejects.toThrow(
        new AppError(404, "Product not found", "PRODUCT_NOT_FOUND")
      );
    });
  });

  describe("updateProduct", () => {
    it("should throw AppError(404) if product to update does not exist", async () => {
      (mockProductRepo.exists as any).mockResolvedValue(false);

      expect(
        productService.updateProduct(companyId, "missing", { name: "Yeni" })
      ).rejects.toThrow(new AppError(404, "Product not found", "PRODUCT_NOT_FOUND"));
    });

    it("should throw AppError(404) if updated vendorId does not exist", async () => {
      (mockProductRepo.exists as any).mockResolvedValue(true);
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(
        productService.updateProduct(companyId, productId, { vendorId: "missing-vendor" })
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
    });

    it("should successfully update product and return updated entity", async () => {
      (mockProductRepo.exists as any).mockResolvedValue(true);
      (mockProductRepo.update as any).mockResolvedValue({
        _id: new ObjectId(productId),
        name: "Güncel Perde",
        price: 1200,
      });

      const result = await productService.updateProduct(companyId, productId, {
        name: "Güncel Perde",
        price: 1200,
      });

      expect(result.name).toBe("Güncel Perde");
      expect(result.price).toBe(1200);
    });
  });

  describe("deleteProduct", () => {
    it("should throw AppError(404) if product does not exist", async () => {
      (mockProductRepo.exists as any).mockResolvedValue(false);

      expect(productService.deleteProduct(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Product not found", "PRODUCT_NOT_FOUND")
      );
    });

    it("should delete product successfully", async () => {
      (mockProductRepo.exists as any).mockResolvedValue(true);
      (mockProductRepo.delete as any).mockResolvedValue(true);

      await expect(productService.deleteProduct(companyId, productId)).resolves.toBeUndefined();
      expect(mockProductRepo.delete).toHaveBeenCalledWith(productId, companyId);
    });
  });
});

import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { VendorService } from "./vendor.service";
import { AppError } from "@/middleware/error-handler";
import type { VendorRepository } from "@/repositories/vendor.repository";
import type { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import type { ProductRepository } from "@/repositories/product.repository";
import type { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import type { VendorPriceRateRepository } from "@/repositories/vendor-price-rate.repository";
import type { Vendor } from "@/types/vendor/vendor";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("VendorService Unit Tests", () => {
  let vendorService: VendorService;
  let mockVendorRepo: Partial<VendorRepository>;
  let mockPermissionRepo: Partial<VendorPermissionRepository>;
  let mockProductRepo: Partial<ProductRepository>;
  let mockDocRepo: Partial<VendorDocumentRepository>;
  let mockPriceRateRepo: Partial<VendorPriceRateRepository>;

  const companyId = "comp-1";
  const vendorId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockVendorRepo = {
      create: mock(),
      findById: mock(),
      findAll: mock(),
      exists: mock(),
      update: mock(),
      delete: mock(),
    };

    mockPermissionRepo = {
      addPermission: mock(),
      removePermission: mock(),
      getVendorIdsForCompany: mock(),
      removeAllPermissionsForVendor: mock(),
    };

    mockProductRepo = {
      deleteByVendorId: mock(),
    };

    mockDocRepo = {
      findAllByVendorId: mock(),
      findById: mock(),
      create: mock(),
      delete: mock(),
      deleteByVendorId: mock(),
    };

    mockPriceRateRepo = {
      findByVendorIds: mock(),
      bulkUpsert: mock(),
    };

    vendorService = new VendorService(
      mockVendorRepo as VendorRepository,
      mockPermissionRepo as VendorPermissionRepository,
      mockProductRepo as ProductRepository,
      mockDocRepo as VendorDocumentRepository,
      mockPriceRateRepo as VendorPriceRateRepository
    );
  });

  describe("createVendor & getVendor", () => {
    it("should create vendor in company successfully", async () => {
      const generatedId = new ObjectId();
      (mockVendorRepo.create as any).mockImplementation((v: any) =>
        Promise.resolve({ ...v, _id: generatedId })
      );

      const result = await vendorService.createVendor(companyId, {
        name: "Somfy Motor",
        phone: "+902120000000",
      });

      expect(result.name).toBe("Somfy Motor");
      expect(result._id).toEqual(generatedId);
    });

    it("should throw AppError(404) if vendor not found", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(vendorService.getVendor(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND")
      );
    });
  });

  describe("deleteVendor (Cascading Deletion)", () => {
    it("should throw AppError(404) if vendor does not exist", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(false);

      expect(vendorService.deleteVendor(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND")
      );
    });

    it("should delete vendor and cascade delete all associated products and documents", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(true);
      (mockVendorRepo.delete as any).mockResolvedValue(true);
      (mockProductRepo.deleteByVendorId as any).mockResolvedValue(5);
      (mockDocRepo.deleteByVendorId as any).mockResolvedValue(2);

      await vendorService.deleteVendor(companyId, vendorId);

      expect(mockProductRepo.deleteByVendorId).toHaveBeenCalledWith(vendorId, companyId);
      expect(mockDocRepo.deleteByVendorId).toHaveBeenCalledWith(vendorId, companyId);
      expect(mockVendorRepo.delete).toHaveBeenCalledWith(vendorId, companyId);
    });
  });

  describe("Vendor Price Rates", () => {
    it("should throw AppError(403) if user is not admin when updating price rates", async () => {
      expect(
        vendorService.updatePriceRates(companyId, "user", [])
      ).rejects.toThrow(new AppError(403, "Only admin users can perform this operation", "FORBIDDEN"));
    });

    it("should bulk update price rates for admin", async () => {
      (mockPriceRateRepo.bulkUpsert as any).mockResolvedValue(undefined);

      await vendorService.updatePriceRates(companyId, "admin", [{ vendorId: new ObjectId(), rate: 10 }] as any);

      expect(mockPriceRateRepo.bulkUpsert).toHaveBeenCalled();
    });
  });

  describe("Permission Management (assertSudo)", () => {
    it("should throw AppError(403) if non-sudo user attempts to grant permission", async () => {
      expect(
        vendorService.grantPermission("admin", vendorId, companyId)
      ).rejects.toThrow(new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN"));
    });

    it("should throw AppError(404) if vendor does not exist when granting permission", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(false);

      expect(
        vendorService.grantPermission("sudo", "missing", companyId)
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
    });
  });

  describe("Vendor Documents", () => {
    it("should throw AppError(404) if vendor does not exist when uploading document", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(false);

      expect(
        vendorService.uploadDocument(companyId, "missing", "user-1", "User One", {
          filename: "price.pdf",
          mimeType: "application/pdf",
          data: Buffer.from("pdf-data"),
        })
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
    });

    it("should throw AppError(400) if uploaded document has unsupported MIME type", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(true);

      expect(
        vendorService.uploadDocument(companyId, vendorId, "user-1", "User One", {
          filename: "bad.exe",
          mimeType: "application/x-msdownload",
          data: Buffer.from("bad-data"),
        })
      ).rejects.toThrow(
        new AppError(400, "Invalid file type. Only PDF and Excel files are allowed.", "INVALID_FILE_TYPE")
      );
    });

    it("should successfully upload valid PDF document", async () => {
      (mockVendorRepo.exists as any).mockResolvedValue(true);
      (mockDocRepo.create as any).mockImplementation((doc: any) =>
        Promise.resolve({ ...doc, _id: new ObjectId(), vendorId: new ObjectId(vendorId) })
      );

      const result = await vendorService.uploadDocument(companyId, vendorId, "user-1", "User One", {
        filename: "fiyat_listesi.pdf",
        mimeType: "application/pdf",
        data: Buffer.from("pdf-binary-data"),
      });

      expect(result.filename).toBe("fiyat_listesi.pdf");
      expect(result.uploaderId).toBe("user-1");
      expect(mockDocRepo.create).toHaveBeenCalled();
    });
  });
});

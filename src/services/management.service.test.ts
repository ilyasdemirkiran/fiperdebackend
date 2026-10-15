import { describe, expect, it, beforeEach, mock, spyOn } from "bun:test";
import { ManagementService } from "./management.service";
import { ManagementRepository } from "@/repositories/management.repository";
import { CompanyRepository } from "@/repositories/company.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { CompanyNoteRepository } from "@/repositories/company-note.repository";
import { SubscriptionRepository } from "@/repositories/subscription.repository";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { ObjectId, Binary } from "mongodb";

describe("ManagementService", () => {
  let service: ManagementService;
  let mockManagementRepo: Partial<ManagementRepository>;
  let mockCompanyRepo: Partial<CompanyRepository>;
  let mockVendorRepo: Partial<VendorRepository>;
  let mockProductRepo: Partial<ProductRepository>;
  let mockPermissionRepo: Partial<VendorPermissionRepository>;
  let mockDocumentRepo: Partial<VendorDocumentRepository>;
  let mockCompanyNoteRepo: Partial<CompanyNoteRepository>;
  let mockSubscriptionRepo: Partial<SubscriptionRepository>;

  const companyId = new ObjectId().toHexString();
  const vendorId = new ObjectId().toHexString();
  const productId = new ObjectId().toHexString();
  const noteId = new ObjectId().toHexString();
  const userId = "user-123";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});

    mockManagementRepo = {
      findAllCompanies: mock(),
      findCompanyById: mock(),
      findUsersByIds: mock(),
      updateUserRole: mock(),
      setUserCompanyId: mock(),
      findAllVendors: mock(),
      findProductsByVendorId: mock(),
    };

    mockCompanyRepo = {
      findById: mock(),
      setDemoCompany: mock(),
    };

    mockVendorRepo = {
      findById: mock(),
      findAll: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
    };

    mockProductRepo = {
      findByVendorId: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
      bulkCreate: mock(),
      bulkDelete: mock(),
      bulkUpdate: mock(),
      deleteByVendorId: mock(),
    };

    mockPermissionRepo = {
      findAll: mock(),
      getCompanyIdsForVendor: mock(),
      addPermission: mock(),
      removePermission: mock(),
      removeAllPermissionsForVendor: mock(),
    };

    mockDocumentRepo = {
      findById: mock(),
      findAllByVendorId: mock(),
      create: mock(),
      deleteByVendorId: mock(),
    };

    mockCompanyNoteRepo = {
      findById: mock(),
      findByCompanyId: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
    };

    mockSubscriptionRepo = {
      findByCompanyId: mock(),
    };

    service = new ManagementService(
      mockManagementRepo as ManagementRepository,
      mockCompanyRepo as CompanyRepository,
      mockVendorRepo as VendorRepository,
      mockProductRepo as ProductRepository,
      mockPermissionRepo as VendorPermissionRepository,
      mockDocumentRepo as VendorDocumentRepository,
      mockCompanyNoteRepo as CompanyNoteRepository,
      mockSubscriptionRepo as SubscriptionRepository
    );
  });

  describe("Company Management", () => {
    it("should set company demo status successfully", async () => {
      (mockCompanyRepo.findById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockCompanyRepo.setDemoCompany as any).mockResolvedValue({
        _id: new ObjectId(companyId),
        isDemo: true,
      });

      const res = await service.setCompanyDemoStatus(companyId, true);
      expect(res.isDemo).toBe(true);
      expect(mockCompanyRepo.setDemoCompany).toHaveBeenCalledWith(companyId, true);
    });

    it("should throw 404 when setting demo status if company not found", async () => {
      (mockCompanyRepo.findById as any).mockResolvedValue(null);

      expect(service.setCompanyDemoStatus(companyId, true)).rejects.toThrow(
        new AppError(404, "Company not found", "COMPANY_NOT_FOUND")
      );
    });

    it("should list companies with populated users and subscription", async () => {
      const comp = { _id: new ObjectId(companyId), name: "Test Corp", userIds: [userId] };
      (mockManagementRepo.findAllCompanies as any).mockResolvedValue([comp]);
      (mockManagementRepo.findUsersByIds as any).mockResolvedValue([{ _id: userId, email: "u@t.com" }]);
      (mockSubscriptionRepo.findByCompanyId as any).mockResolvedValue({ status: "active" });

      const list = await service.listCompaniesWithUsers();
      expect(list).toHaveLength(1);
      expect(list[0]!.users).toHaveLength(1);
      expect(list[0]!.subscription?.status).toBe("active");
    });

    it("should promote and demote admin roles", async () => {
      await service.promoteToAdmin(companyId, userId);
      expect(mockManagementRepo.updateUserRole).toHaveBeenCalledWith(userId, "admin");

      await service.demoteFromAdmin(companyId, userId);
      expect(mockManagementRepo.updateUserRole).toHaveBeenCalledWith(userId, "user");
    });

    it("should set user company id", async () => {
      await service.setUserCompanyId(userId, companyId);
      expect(mockManagementRepo.setUserCompanyId).toHaveBeenCalledWith(userId, companyId);
    });
  });

  describe("Vendor Management (Global)", () => {
    it("should list all global vendors", async () => {
      (mockManagementRepo.findAllVendors as any).mockResolvedValue([{ _id: new ObjectId(vendorId), name: "V1" }]);

      const list = await service.listVendors();
      expect(list).toHaveLength(1);
    });

    it("should get vendor with products", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({ _id: new ObjectId(vendorId), name: "V1" });
      (mockManagementRepo.findProductsByVendorId as any).mockResolvedValue([{ _id: new ObjectId(), name: "P1" }]);

      const res = await service.getVendorWithProducts(vendorId);
      expect(res.name).toBe("V1");
      expect(res.products).toHaveLength(1);
    });

    it("should throw 404 if vendor not found when getting with products", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(service.getVendorWithProducts(vendorId)).rejects.toThrow(
        new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND")
      );
    });

    it("should create vendor", async () => {
      const data = { name: "New Vendor", phone: "123", city: "Istanbul", district: "Kadikoy", address: "Adres" };
      (mockVendorRepo.create as any).mockResolvedValue({ _id: new ObjectId(vendorId), ...data });

      const res = await service.createVendor(data);
      expect(res.name).toBe("New Vendor");
      expect(mockVendorRepo.create).toHaveBeenCalled();
    });

    it("should update vendor", async () => {
      (mockVendorRepo.update as any).mockResolvedValue({ _id: new ObjectId(vendorId), name: "Updated" });

      const res = await service.updateVendor(vendorId, { name: "Updated" });
      expect(res.name).toBe("Updated");
    });

    it("should delete vendor and cascade products, docs, and permissions", async () => {
      (mockVendorRepo.delete as any).mockResolvedValue(true);
      (mockProductRepo.deleteByVendorId as any).mockResolvedValue(5);
      (mockDocumentRepo.deleteByVendorId as any).mockResolvedValue(2);
      (mockPermissionRepo.removeAllPermissionsForVendor as any).mockResolvedValue(3);

      await expect(service.deleteVendor(vendorId)).resolves.toBeUndefined();
      expect(mockProductRepo.deleteByVendorId).toHaveBeenCalledWith(vendorId);
      expect(mockDocumentRepo.deleteByVendorId).toHaveBeenCalledWith(vendorId);
      expect(mockPermissionRepo.removeAllPermissionsForVendor).toHaveBeenCalledWith(vendorId);
    });

    it("should set vendor access by calculating additions and removals", async () => {
      (mockPermissionRepo.getCompanyIdsForVendor as any).mockResolvedValue(["comp-1", "comp-2"]);

      await service.setVendorAccess(vendorId, ["comp-2", "comp-3"]);

      expect(mockPermissionRepo.addPermission).toHaveBeenCalledWith(vendorId, "comp-3");
      expect(mockPermissionRepo.removePermission).toHaveBeenCalledWith(vendorId, "comp-1");
    });

    it("should list all vendor permissions", async () => {
      (mockPermissionRepo.findAll as any).mockResolvedValue([{ vendorId, companyId, createdAt: {} }]);

      const res = await service.listAllVendorPermissions();
      expect(res).toHaveLength(1);
    });
  });

  describe("copyVendorToCompany", () => {
    it("should throw 404 if target company does not exist", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue(null);

      expect(service.copyVendorToCompany(vendorId, companyId)).rejects.toThrow(
        new AppError(404, "Company not found", "COMPANY_NOT_FOUND")
      );
    });

    it("should throw 404 if global vendor does not exist", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(service.copyVendorToCompany(vendorId, companyId)).rejects.toThrow(
        new AppError(404, "Global vendor not found", "VENDOR_NOT_FOUND")
      );
    });

    it("should skip copy if vendor already exists in company by name", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockVendorRepo.findById as any).mockResolvedValue({ _id: new ObjectId(vendorId), name: "Global Vendor" });
      (mockVendorRepo.findAll as any).mockResolvedValue([
        { _id: new ObjectId(), name: "global vendor" },
      ]);

      const res = await service.copyVendorToCompany(vendorId, companyId);
      expect(res.alreadyExists).toBe(true);
      expect(res.copiedProductsCount).toBe(0);
    });

    it("should clone vendor, products, and documents into target company", async () => {
      const targetVendorId = new ObjectId().toHexString();
      (mockManagementRepo.findCompanyById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockVendorRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(vendorId),
        name: "Global Vendor",
        phone: "111",
      });
      (mockVendorRepo.findAll as any).mockResolvedValue([]);
      (mockVendorRepo.create as any).mockResolvedValue({
        _id: new ObjectId(targetVendorId),
        name: "Global Vendor",
      });

      (mockProductRepo.findByVendorId as any).mockResolvedValue([
        { name: "P1", code: "C1", price: 100, currency: "TRY" },
      ]);
      (mockProductRepo.bulkCreate as any).mockResolvedValue([{ _id: new ObjectId() }]);

      (mockDocumentRepo.findAllByVendorId as any).mockResolvedValue([
        { _id: new ObjectId() },
      ]);
      (mockDocumentRepo.findById as any).mockResolvedValue({
        title: "Doc1",
        data: new Binary(Buffer.from("doc")),
        filename: "doc1.pdf",
        mimeType: "application/pdf",
        size: 100,
      });
      (mockDocumentRepo.create as any).mockResolvedValue({ _id: new ObjectId() });

      const res = await service.copyVendorToCompany(vendorId, companyId);
      expect(res.copiedProductsCount).toBe(1);
      expect(res.copiedDocumentsCount).toBe(1);
      expect(mockProductRepo.bulkCreate).toHaveBeenCalled();
      expect(mockDocumentRepo.create).toHaveBeenCalled();
    });
  });

  describe("Product Management (Global)", () => {
    it("should create global product", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({ _id: new ObjectId(vendorId), name: "Vendor 1" });
      (mockProductRepo.create as any).mockResolvedValue({ _id: new ObjectId(productId), name: "Prod 1" });

      const res = await service.createProduct(vendorId, {
        name: "Prod 1",
        code: "P1",
        price: 10,
        currency: "USD",
        description: "Desc",
      });
      expect(res.name).toBe("Prod 1");
    });

    it("should throw 404 on create product if vendor not found", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(
        service.createProduct(vendorId, {
          name: "Prod 1",
          code: "P1",
          price: 10,
          currency: "USD",
          description: "Desc",
        })
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
    });

    it("should update global product", async () => {
      (mockProductRepo.update as any).mockResolvedValue({ _id: new ObjectId(productId), price: 20 });

      const res = await service.updateProduct(productId, { price: 20 });
      expect(res.price).toBe(20);
    });

    it("should delete global product", async () => {
      (mockProductRepo.delete as any).mockResolvedValue(true);

      await expect(service.deleteProduct(productId)).resolves.toBeUndefined();
    });

    it("should bulk create, update, and delete products", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({ _id: new ObjectId(vendorId), name: "Vendor 1" });
      (mockProductRepo.bulkCreate as any).mockResolvedValue([{ _id: new ObjectId() }]);
      (mockProductRepo.bulkUpdate as any).mockResolvedValue(2);
      (mockProductRepo.bulkDelete as any).mockResolvedValue(3);

      const created = await service.bulkCreateProducts(vendorId, [
        { name: "P1", code: "C1", price: 10, currency: "USD", description: "" },
      ]);
      expect(created).toHaveLength(1);

      const updatedCount = await service.bulkUpdateProducts(vendorId, [
        { productId, data: { price: 50 } },
      ]);
      expect(updatedCount).toBe(2);

      const deletedCount = await service.bulkDeleteProducts(vendorId, [productId]);
      expect(deletedCount).toBe(3);
    });
  });

  describe("Company Note Management", () => {
    it("should create company note", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockCompanyNoteRepo.create as any).mockImplementation((note: any) => Promise.resolve(note));

      const note = await service.createCompanyNote(companyId, userId, "Test company note");
      expect(note.note).toBe("Test company note");
      expect(note.userId).toBe(userId);
    });

    it("should throw 404 when creating note for non-existent company", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue(null);

      expect(service.createCompanyNote(companyId, userId, "Note")).rejects.toThrow(
        new AppError(404, "Company not found", "COMPANY_NOT_FOUND")
      );
    });

    it("should get company note by ID", async () => {
      (mockCompanyNoteRepo.findById as any).mockResolvedValue({ _id: new ObjectId(noteId), note: "Saved note" });

      const res = await service.getCompanyNote(noteId);
      expect(res.note).toBe("Saved note");
    });

    it("should list company notes", async () => {
      (mockManagementRepo.findCompanyById as any).mockResolvedValue({ _id: new ObjectId(companyId) });
      (mockCompanyNoteRepo.findByCompanyId as any).mockResolvedValue([{ _id: new ObjectId(noteId) }]);

      const list = await service.listCompanyNotes(companyId);
      expect(list).toHaveLength(1);
    });

    it("should update company note", async () => {
      (mockCompanyNoteRepo.findById as any).mockResolvedValue({ _id: new ObjectId(noteId), note: "Old note" });
      (mockCompanyNoteRepo.update as any).mockResolvedValue({ _id: new ObjectId(noteId), note: "New note" });

      const updated = await service.updateCompanyNote(noteId, "New note");
      expect(updated.note).toBe("New note");
    });

    it("should delete company note", async () => {
      (mockCompanyNoteRepo.findById as any).mockResolvedValue({ _id: new ObjectId(noteId) });
      (mockCompanyNoteRepo.delete as any).mockResolvedValue(true);

      await expect(service.deleteCompanyNote(noteId)).resolves.toBeUndefined();
      expect(mockCompanyNoteRepo.delete).toHaveBeenCalledWith(noteId);
    });
  });
});

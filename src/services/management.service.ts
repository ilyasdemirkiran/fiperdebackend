import { ManagementRepository } from "@/repositories/management.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { CompanyNoteRepository } from "@/repositories/company-note.repository";
import { SubscriptionRepository } from "@/repositories/subscription.repository";
import {
  createCompanyNoteSchema,
  updateCompanyNoteSchema,
  type CompanyNoteDb,
} from "@/types/company/company_note";
import type { CompanyWithUsers, VendorWithProducts } from "@/types/management/management";
import type { Vendor } from "@/types/vendor/vendor";
import type { Product } from "@/types/vendor/product/product";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { ObjectId } from "mongodb";

export class ManagementService {
  private repository: ManagementRepository;
  private vendorRepo: VendorRepository;
  private productRepo: ProductRepository;
  private permissionRepo: VendorPermissionRepository;
  private documentRepo: VendorDocumentRepository;
  private companyNoteRepo: CompanyNoteRepository;
  private subscriptionRepo: SubscriptionRepository;

  constructor() {
    this.repository = new ManagementRepository();
    this.vendorRepo = new VendorRepository();
    this.productRepo = new ProductRepository();
    this.permissionRepo = new VendorPermissionRepository();
    this.documentRepo = new VendorDocumentRepository();
    this.companyNoteRepo = new CompanyNoteRepository();
    this.subscriptionRepo = new SubscriptionRepository();
  }

  // =====================
  // COMPANY MANAGEMENT
  // =====================

  async listCompaniesWithUsers(): Promise<CompanyWithUsers[]> {
    const companies = await this.repository.findAllCompanies();

    const companiesWithUsers: CompanyWithUsers[] = await Promise.all(
      companies.map(async (company) => {
        const [users, subscription] = await Promise.all([
          this.repository.findUsersByIds(company.userIds),
          this.subscriptionRepo.findByCompanyId(company._id!.toString())
        ]);
        return { ...company, users, subscription };
      })
    );

    return companiesWithUsers;
  }

  async promoteToAdmin(companyId: string, userId: string): Promise<void> {
    await this.repository.updateUserRole(userId, "admin");
    logger.info("User promoted to admin", { companyId, userId });
  }

  async demoteFromAdmin(companyId: string, userId: string): Promise<void> {
    await this.repository.updateUserRole(userId, "user");
    logger.info("User demoted from admin", { companyId, userId });
  }

  async setUserCompanyId(userId: string, companyId: string): Promise<void> {
    await this.repository.setUserCompanyId(userId, companyId);
  }
  // =====================
  // VENDOR MANAGEMENT
  // =====================

  async listVendors(): Promise<Vendor[]> {
    return await this.repository.findAllVendors();
  }

  async getVendorWithProducts(vendorId: string): Promise<VendorWithProducts> {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const products = await this.repository.findProductsByVendorId(vendorId);

    return { ...vendor, products };
  }

  async createVendor(
    data: Pick<Vendor, "name" | "phone" | "city" | "district" | "address">
  ): Promise<Vendor> {
    const vendor: Omit<Vendor, "_id"> = {
      name: data.name,
      phone: data.phone,
      city: data.city,
      district: data.district,
      address: data.address,
      createdAt: Timestamp.now(),
    };

    return await this.vendorRepo.create(vendor);
  }

  async updateVendor(
    vendorId: string,
    data: Partial<Pick<Vendor, "name" | "phone" | "city" | "district" | "address">>
  ): Promise<Vendor> {
    const updated = await this.vendorRepo.update(vendorId, data);
    if (!updated) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    return updated;
  }

  async deleteVendor(vendorId: string): Promise<void> {
    const deleted = await this.vendorRepo.delete(vendorId);
    if (!deleted) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Cascade delete all related data
    const [productsDeleted, documentsDeleted, permissionsDeleted] = await Promise.all([
      this.productRepo.deleteByVendorId(vendorId),
      this.documentRepo.deleteByVendorId(vendorId),
      this.permissionRepo.removeAllPermissionsForVendor(vendorId),
    ]);

    logger.info("Vendor deleted with cascade", {
      vendorId,
      productsDeleted,
      documentsDeleted,
      permissionsDeleted,
    });
  }

  async setVendorAccess(vendorId: string, companyIds: string[]): Promise<void> {
    // Get current permissions
    const currentPermissions = await this.permissionRepo.getCompanyIdsForVendor(vendorId);

    // Find permissions to add and remove
    const toAdd = companyIds.filter(id => !currentPermissions.includes(id));
    const toRemove = currentPermissions.filter(id => !companyIds.includes(id));

    // Add new permissions
    for (const companyId of toAdd) {
      await this.permissionRepo.addPermission(vendorId, companyId);
    }

    // Remove old permissions
    for (const companyId of toRemove) {
      await this.permissionRepo.removePermission(vendorId, companyId);
    }

    logger.info("Vendor access updated via permissions", { vendorId, added: toAdd, removed: toRemove });
  }

  /**
   * Get all vendor permissions for management dashboard
   */
  async listAllVendorPermissions(): Promise<Array<{ vendorId: string; companyId: string; createdAt: any }>> {
    return await this.permissionRepo.findAll();
  }

  // =====================
  // PRODUCT MANAGEMENT
  // =====================

  async createProduct(
    vendorId: string,
    data: Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">
  ): Promise<Product> {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const productData: Omit<Product, "_id" | "vendorId"> & { vendorName?: string } = {
      ...data,
      vendorName: vendor.name,
      createdAt: Timestamp.now(),
    };

    return await this.productRepo.create(productData as any, vendorId);
  }

  async updateProduct(
    productId: string,
    data: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">>
  ): Promise<Product> {
    const updated = await this.productRepo.update(productId, data);
    if (!updated) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    return updated;
  }

  async deleteProduct(productId: string): Promise<void> {
    const deleted = await this.productRepo.delete(productId);
    if (!deleted) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    logger.info("Product deleted", { productId });
  }

  async bulkCreateProducts(
    vendorId: string,
    products: Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">[]
  ): Promise<Product[]> {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const productsData = products.map((p) => ({
      ...p,
      vendorName: vendor.name,
      createdAt: Timestamp.now(),
    }));

    return await this.productRepo.bulkCreate(productsData as any, vendorId);
  }

  async bulkDeleteProducts(
    vendorId: string,
    productIds: string[]
  ): Promise<number> {
    const deletedCount = await this.productRepo.bulkDelete(productIds, vendorId);
    logger.info("Products bulk deleted", { vendorId, requestedCount: productIds.length, deletedCount });
    return deletedCount;
  }

  async bulkUpdateProducts(
    vendorId: string,
    updates: { productId: string; data: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">> }[]
  ): Promise<number> {
    const modifiedCount = await this.productRepo.bulkUpdate(updates, vendorId);
    logger.info("Products bulk updated", { vendorId, requestedCount: updates.length, modifiedCount });
    return modifiedCount;
  }

  // =====================
  // COMPANY NOTE MANAGEMENT
  // =====================

  async createCompanyNote(
    companyId: string,
    userId: string,
    noteText: string
  ): Promise<CompanyNoteDb> {
    const company = await this.repository.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
    }

    const validated = createCompanyNoteSchema.parse({
      companyId: new ObjectId(companyId),
      userId,
      note: noteText,
      createdAt: Timestamp.now(),
    });

    const note: CompanyNoteDb = {
      _id: new ObjectId(),
      ...validated,
    };

    return await this.companyNoteRepo.create(note);
  }

  async getCompanyNote(id: string): Promise<CompanyNoteDb> {
    const note = await this.companyNoteRepo.findById(id);
    if (!note) {
      throw new AppError(404, "Company note not found", "COMPANY_NOTE_NOT_FOUND");
    }
    return note;
  }

  async listCompanyNotes(companyId: string): Promise<CompanyNoteDb[]> {
    const company = await this.repository.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
    }

    return await this.companyNoteRepo.findByCompanyId(companyId);
  }

  async updateCompanyNote(
    id: string,
    noteText: string
  ): Promise<CompanyNoteDb> {
    const exists = await this.companyNoteRepo.findById(id);
    if (!exists) {
      throw new AppError(404, "Company note not found", "COMPANY_NOTE_NOT_FOUND");
    }

    const validated = updateCompanyNoteSchema.parse({
      note: noteText,
    });

    const updated = await this.companyNoteRepo.update(id, {
      ...validated,
      updatedAt: Timestamp.now(),
    });

    if (!updated) {
      throw new AppError(500, "Failed to update company note", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteCompanyNote(id: string): Promise<void> {
    const exists = await this.companyNoteRepo.findById(id);
    if (!exists) {
      throw new AppError(404, "Company note not found", "COMPANY_NOTE_NOT_FOUND");
    }

    const deleted = await this.companyNoteRepo.delete(id);
    if (!deleted) {
      throw new AppError(500, "Failed to delete company note", "DELETE_FAILED");
    }
  }
}

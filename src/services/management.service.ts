import { ManagementRepository } from "@/repositories/management.repository";
import { CompanyRepository } from "@/repositories/company.repository";
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
import type { Company } from "@/types/company/company";
import type { Vendor } from "@/types/vendor/vendor";
import type { Product } from "@/types/vendor/product/product";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { ObjectId } from "mongodb";

export class ManagementService {
  private repository: ManagementRepository;
  private companyRepo: CompanyRepository;
  private vendorRepo: VendorRepository;
  private productRepo: ProductRepository;
  private permissionRepo: VendorPermissionRepository;
  private documentRepo: VendorDocumentRepository;
  private companyNoteRepo: CompanyNoteRepository;
  private subscriptionRepo: SubscriptionRepository;

  constructor() {
    this.repository = new ManagementRepository();
    this.companyRepo = new CompanyRepository();
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

  async setCompanyDemoStatus(companyId: string, isDemo: boolean): Promise<Company> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
    }

    const updated = await this.companyRepo.setDemoCompany(companyId, isDemo);
    if (!updated) {
      throw new AppError(500, "Failed to update demo company status", "UPDATE_FAILED");
    }

    logger.info("Company demo status updated", { companyId, isDemo });
    return updated;
  }

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

  /**
   * Delete company permanently (Sudo only)
   * 1. Drops the tenant MongoDB database (fi_<companyId>)
   * 2. Deletes all associated users from fiperde_core.users
   * 3. Deletes all company invites from fiperde_core.company_invites
   * 4. Deletes all company notes from fiperde_core.company_notes
   * 5. Deletes subscriptions from fiperde_core.subscriptions
   * 6. Deletes the company from fiperde_core.companies
   */
  async deleteCompanyPermanently(companyId: string): Promise<void> {
    const company = await this.repository.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
    }

    // 1. Drop tenant database (fi_<companyId>)
    const { dropCompanyDatabase } = await import("@/config/database");
    await dropCompanyDatabase(companyId);

    // 2. Delete all users belonging to this company or listed in company.userIds
    const {
      getUsersCollection,
      getCompanyInvitesCollection,
      getCompanyNotesCollection,
      getSubscriptionCollection,
      getCompaniesCollection,
    } = await import("@/repositories/collections/core.collections");

    const usersColl = getUsersCollection();
    const invitesColl = getCompanyInvitesCollection();
    const notesColl = getCompanyNotesCollection();
    const subsColl = getSubscriptionCollection();
    const compColl = getCompaniesCollection();

    // Delete users by companyId or in userIds
    await usersColl.deleteMany({
      $or: [
        { companyId },
        { _id: { $in: company.userIds || [] } as any },
      ],
    });

    // 3. Delete company invites
    await invitesColl.deleteMany({ companyId });

    // 4. Delete company notes (companyId is ObjectId)
    await notesColl.deleteMany({ companyId: new ObjectId(companyId) as any });

    // 5. Delete subscriptions
    await subsColl.deleteMany({ companyId });

    // 6. Delete company document
    await compColl.deleteOne({ _id: new ObjectId(companyId) });

    logger.info("Company deleted permanently by sudo", { companyId, name: company.name });
  }

  // =====================
  // VENDOR MANAGEMENT (GLOBAL)
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

    // Cascade delete all related global data
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

  async listAllVendorPermissions(): Promise<Array<{ vendorId: string; companyId: string; createdAt: any }>> {
    return await this.permissionRepo.findAll();
  }

  // =====================
  // COPY VENDOR TO COMPANY (GLOBAL -> TENANT DB)
  // =====================

  /**
   * Copy a master vendor along with all its products and documents from global DB to target company DB
   */
  async copyVendorToCompany(
    vendorId: string,
    targetCompanyId: string
  ): Promise<{ vendor: Vendor; copiedProductsCount: number; copiedDocumentsCount: number; alreadyExists?: boolean }> {
    // 1. Verify target company exists
    const company = await this.repository.findCompanyById(targetCompanyId);
    if (!company) {
      throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
    }

    // 2. Fetch master vendor from global DB
    const globalVendor = await this.vendorRepo.findById(vendorId);
    if (!globalVendor) {
      throw new AppError(404, "Global vendor not found", "VENDOR_NOT_FOUND");
    }

    // 3. Check if vendor already exists in target company by name (prevent duplicate copy)
    const existingVendors = await this.vendorRepo.findAll(targetCompanyId);
    const existingVendor = existingVendors.find(
      (v) => v.name.trim().toLowerCase() === globalVendor.name.trim().toLowerCase()
    );

    if (existingVendor) {
      logger.info("Vendor already exists in target company, skipping copy", {
        vendorId,
        vendorName: globalVendor.name,
        targetCompanyId,
        targetVendorId: existingVendor._id,
      });
      return {
        vendor: existingVendor,
        copiedProductsCount: 0,
        copiedDocumentsCount: 0,
        alreadyExists: true,
      };
    }

    // 4. Create/Clone vendor in target company DB
    const targetVendorData: Omit<Vendor, "_id"> = {
      name: globalVendor.name,
      phone: globalVendor.phone,
      city: globalVendor.city,
      district: globalVendor.district,
      address: globalVendor.address,
      createdAt: Timestamp.now(),
    };

    let targetVendor: Vendor;
    try {
      targetVendor = await this.vendorRepo.create(targetVendorData, targetCompanyId);
    } catch (err: any) {
      if (err?.code === 11000 || err?.message?.includes("E11000")) {
        const vendorAgain = (await this.vendorRepo.findAll(targetCompanyId)).find(
          (v) => v.name.trim().toLowerCase() === globalVendor.name.trim().toLowerCase()
        );
        return {
          vendor: vendorAgain || (globalVendor as any),
          copiedProductsCount: 0,
          copiedDocumentsCount: 0,
          alreadyExists: true,
        };
      }
      throw err;
    }
    const targetVendorId = targetVendor._id!.toString();

    // 5. Fetch and copy all products from global DB
    const globalProducts = await this.productRepo.findByVendorId(vendorId);
    let copiedProductsCount = 0;

    if (globalProducts.length > 0) {
      const productsToCopy = globalProducts.map((p) => ({
        name: p.name,
        code: p.code,
        price: p.price,
        currency: p.currency,
        description: p.description,
        vendorName: targetVendor.name,
        createdAt: Timestamp.now(),
      }));

      const createdProducts = await this.productRepo.bulkCreate(
        productsToCopy as any,
        targetVendorId,
        targetCompanyId
      );
      copiedProductsCount = createdProducts.length;
    }

    // 6. Fetch and copy all documents/attachments from global DB
    const globalDocuments = await this.documentRepo.findAllByVendorId(vendorId);
    let copiedDocumentsCount = 0;

    for (const docMeta of globalDocuments) {
      const fullDoc = await this.documentRepo.findById(docMeta._id!.toString());
      if (fullDoc) {
        const docToCopy = {
          title: fullDoc.title,
          description: fullDoc.description || "",
          uploadedAt: Timestamp.now(),
          uploaderId: fullDoc.uploaderId,
          uploaderName: fullDoc.uploaderName,
          filename: fullDoc.filename,
          mimeType: fullDoc.mimeType,
          size: fullDoc.size,
          data: fullDoc.data,
        };

        await this.documentRepo.create(docToCopy as any, targetVendorId, targetCompanyId);
        copiedDocumentsCount++;
      }
    }

    logger.info("Vendor copied to company", {
      sourceVendorId: vendorId,
      targetCompanyId,
      targetVendorId,
      copiedProductsCount,
      copiedDocumentsCount,
    });

    return {
      vendor: targetVendor,
      copiedProductsCount,
      copiedDocumentsCount,
    };
  }

  /**
   * Migration utility: Copy all global vendors to companies where permissions were granted.
   * Copies vendors, their products, and vendor documents to each permitted company's database.
   */
  async migratePermittedVendorsToCompanies(): Promise<{
    migratedCount: number;
    skippedCount: number;
    errors: Array<{ vendorId: string; companyId: string; error: string }>;
    details: Array<{
      vendorId: string;
      vendorName: string;
      companyId: string;
      copiedProductsCount: number;
      copiedDocumentsCount: number;
      alreadyExists?: boolean;
    }>;
  }> {
    const permissions = await this.permissionRepo.findAll();

    // De-duplicate (vendorId, companyId) pairs
    const uniquePermissionsMap = new Map<string, { vendorId: string; companyId: string }>();
    for (const perm of permissions) {
      const key = `${perm.vendorId}_${perm.companyId}`;
      if (!uniquePermissionsMap.has(key)) {
        uniquePermissionsMap.set(key, { vendorId: perm.vendorId, companyId: perm.companyId });
      }
    }
    const uniquePermissions = Array.from(uniquePermissionsMap.values());

    const details: Array<{
      vendorId: string;
      vendorName: string;
      companyId: string;
      copiedProductsCount: number;
      copiedDocumentsCount: number;
      alreadyExists?: boolean;
    }> = [];
    const errors: Array<{ vendorId: string; companyId: string; error: string }> = [];
    let skippedCount = 0;

    for (const perm of uniquePermissions) {
      try {
        const company = await this.repository.findCompanyById(perm.companyId);
        if (!company) {
          skippedCount++;
          continue;
        }

        const globalVendor = await this.vendorRepo.findById(perm.vendorId);
        if (!globalVendor) {
          skippedCount++;
          continue;
        }

        const res = await this.copyVendorToCompany(perm.vendorId, perm.companyId);
        if (res.alreadyExists) {
          skippedCount++;
        } else {
          details.push({
            vendorId: perm.vendorId,
            vendorName: globalVendor.name,
            companyId: perm.companyId,
            copiedProductsCount: res.copiedProductsCount,
            copiedDocumentsCount: res.copiedDocumentsCount,
          });
        }
      } catch (err: any) {
        logger.error("Error migrating permitted vendor to company", err, {
          vendorId: perm.vendorId,
          companyId: perm.companyId,
        });
        errors.push({
          vendorId: perm.vendorId,
          companyId: perm.companyId,
          error: err?.message || String(err),
        });
      }
    }

    logger.info("Permitted vendors migration completed", {
      migratedCount: details.length,
      skippedCount,
      errorsCount: errors.length,
    });

    return {
      migratedCount: details.length,
      skippedCount,
      errors,
      details,
    };
  }

  // =====================

  // PRODUCT MANAGEMENT (GLOBAL)
  // =====================

  async createProduct(
    vendorId: string,
    data: Pick<Product, "name" | "code" | "price" | "currency" | "description">
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
    data: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description">>
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
    products: Pick<Product, "name" | "code" | "price" | "currency" | "description">[]
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
    updates: { productId: string; data: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description">> }[]
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

import { VendorRepository } from "@/repositories/vendor.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { VendorPriceRateRepository } from "@/repositories/vendor-price-rate.repository";
import type { Vendor } from "@/types/vendor/vendor";
import type { VendorDocument, VendorDocumentMetadata } from "@/types/vendor/vendor_document";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/types/vendor/vendor_document";
import type { VendorPriceRate } from "@/types/vendor/vendor_price_rate";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import type { UserRole } from "@/types/user/fi_user";
import { isAdmin } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import { Binary, ObjectId } from "mongodb";

export class VendorService {
  private repository: VendorRepository;
  private permissionRepository: VendorPermissionRepository;
  private productRepository: ProductRepository;
  private documentRepository: VendorDocumentRepository;
  private priceRateRepository: VendorPriceRateRepository;

  constructor() {
    this.repository = new VendorRepository();
    this.permissionRepository = new VendorPermissionRepository();
    this.productRepository = new ProductRepository();
    this.documentRepository = new VendorDocumentRepository();
    this.priceRateRepository = new VendorPriceRateRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN");
    }
  }

  // ========== COMPANY VENDOR MANAGEMENT ==========

  /**
   * Create vendor in company's database
   */
  async createVendor(
    companyId: string,
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

    return await this.repository.create(vendor, companyId);
  }

  /**
   * Get vendor from company's database
   */
  async getVendor(companyId: string, id: string): Promise<Vendor> {
    const vendor = await this.repository.findById(id, companyId);

    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    return vendor;
  }

  /**
   * List all vendors in company's database
   */
  async listVendorsForCompany(companyId: string): Promise<Vendor[]> {
    return await this.repository.findAll(companyId);
  }

  /**
   * Update vendor in company's database
   */
  async updateVendor(
    companyId: string,
    id: string,
    updates: Partial<Pick<Vendor, "name" | "phone" | "city" | "district" | "address">>
  ): Promise<Vendor> {
    const exists = await this.repository.exists(id, companyId);
    if (!exists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const updated = await this.repository.update(id, updates, companyId);

    if (!updated) {
      throw new AppError(500, "Failed to update vendor", "UPDATE_FAILED");
    }

    return updated;
  }

  /**
   * Delete vendor in company's database (cascade deletes products and documents in company DB)
   */
  async deleteVendor(companyId: string, id: string): Promise<void> {
    const exists = await this.repository.exists(id, companyId);
    if (!exists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Delete vendor and cascade delete related data from company database
    await Promise.all([
      this.repository.delete(id, companyId),
      this.productRepository.deleteByVendorId(id, companyId),
      this.documentRepository.deleteByVendorId(id, companyId),
    ]);

    logger.info("Vendor deleted from company database with cascade", { vendorId: id, companyId });
  }

  // ========== GLOBAL VENDOR OPERATIONS (FOR MANAGEMENT/SUDO) ==========

  async listAllGlobalVendors(): Promise<Vendor[]> {
    return await this.repository.findAll();
  }

  // ========== PERMISSION MANAGEMENT (LEGACY / MANAGEMENT COMPAT) ==========

  async grantPermission(role: UserRole, vendorId: string, companyId: string): Promise<void> {
    this.assertSudo(role);

    const vendorExists = await this.repository.exists(vendorId);
    if (!vendorExists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const hasPermission = await this.permissionRepository.hasPermission(vendorId, companyId);
    if (hasPermission) {
      throw new AppError(409, "Permission already exists", "PERMISSION_EXISTS");
    }

    await this.permissionRepository.addPermission(vendorId, companyId);
    logger.info("Vendor permission granted", { vendorId, companyId });
  }

  async revokePermission(role: UserRole, vendorId: string, companyId: string): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.permissionRepository.removePermission(vendorId, companyId);

    if (!deleted) {
      throw new AppError(404, "Permission not found", "PERMISSION_NOT_FOUND");
    }

    logger.info("Vendor permission revoked", { vendorId, companyId });
  }

  async getCompaniesForVendor(vendorId: string): Promise<string[]> {
    const vendorExists = await this.repository.exists(vendorId);
    if (!vendorExists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    return await this.permissionRepository.getCompanyIdsForVendor(vendorId);
  }

  // ========== PRICE RATE MANAGEMENT ==========

  /**
   * Get price rates for all vendors in company's database
   */
  async getPriceRatesForCompany(companyId: string): Promise<VendorPriceRate[]> {
    const vendors = await this.repository.findAll(companyId);

    if (vendors.length === 0) {
      return [];
    }

    const objectIds = vendors.map((v) => new ObjectId(v._id));
    return await this.priceRateRepository.findByVendorIds(companyId, objectIds);
  }

  /**
   * Bulk update price rates (admin/sudo only)
   */
  async updatePriceRates(companyId: string, role: UserRole, rates: VendorPriceRate[]): Promise<void> {
    if (!isAdmin(role)) {
      throw new AppError(403, "Only admin users can perform this operation", "FORBIDDEN");
    }

    await this.priceRateRepository.bulkUpsert(companyId, rates);
  }

  // ========== DOCUMENT MANAGEMENT ==========

  /**
   * Upload a document for a vendor in company database
   */
  async uploadDocument(
    companyId: string,
    vendorId: string,
    uploaderId: string,
    uploaderName: string,
    file: {
      filename: string;
      mimeType: string;
      data: Buffer;
      title?: string;
      description?: string;
    }
  ): Promise<VendorDocumentMetadata> {
    const vendorExists = await this.repository.exists(vendorId, companyId);
    if (!vendorExists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Validate mime type
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimeType as any)) {
      throw new AppError(400, "Invalid file type. Only PDF and Excel files are allowed.", "INVALID_FILE_TYPE");
    }

    const documentData: Omit<VendorDocument, "_id" | "vendorId"> = {
      title: file.title || file.filename,
      description: file.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      uploaderName,
      filename: file.filename,
      mimeType: file.mimeType as any,
      size: file.data.length,
      data: new Binary(file.data),
    };

    const created = await this.documentRepository.create(documentData as any, vendorId, companyId);

    // Return metadata without binary data
    const { data, ...metadata } = created;
    return metadata;
  }

  /**
   * Get latest document for a vendor (from company database)
   */
  async getLatestDocument(companyId: string, vendorId: string): Promise<{ metadata: VendorDocumentMetadata; buffer: Buffer } | null> {
    const document = await this.documentRepository.findLatestByVendorId(vendorId, companyId);

    if (!document) {
      return null;
    }

    const { data, ...metadata } = document;
    return {
      metadata,
      buffer: Buffer.from(data.buffer),
    };
  }

  /**
   * Get latest document metadata for a vendor (from company database)
   */
  async getLatestDocumentMetadata(companyId: string, vendorId: string): Promise<VendorDocumentMetadata | null> {
    return await this.documentRepository.findLatestMetadataByVendorId(vendorId, companyId);
  }

  /**
   * Get all documents for a vendor (for management / global)
   */
  async getAllDocuments(role: UserRole, vendorId: string, companyId?: string): Promise<VendorDocumentMetadata[]> {
    return await this.documentRepository.findAllByVendorId(vendorId, companyId);
  }

  /**
   * Get document binary for download
   */
  async getDocumentData(documentId: string, companyId?: string): Promise<{ metadata: VendorDocumentMetadata; buffer: Buffer }> {
    const document = await this.documentRepository.findById(documentId, companyId);

    if (!document) {
      throw new AppError(404, "Document not found", "DOCUMENT_NOT_FOUND");
    }

    const { data, ...metadata } = document;
    return {
      metadata,
      buffer: Buffer.from(data.buffer),
    };
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, companyId?: string): Promise<void> {
    const deleted = await this.documentRepository.delete(documentId, companyId);
    if (!deleted) {
      throw new AppError(404, "Document not found", "DOCUMENT_NOT_FOUND");
    }

    logger.info("Vendor document deleted", { documentId, companyId });
  }
}

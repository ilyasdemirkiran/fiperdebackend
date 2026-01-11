import { VendorRepository } from "@/repositories/vendor.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import type { Vendor } from "@/types/vendor/vendor";
import type { VendorDocument, VendorDocumentMetadata } from "@/types/vendor/vendor_document";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/types/vendor/vendor_document";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import type { UserRole } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import { Binary } from "mongodb";

export class VendorService {
  private repository: VendorRepository;
  private permissionRepository: VendorPermissionRepository;
  private productRepository: ProductRepository;
  private documentRepository: VendorDocumentRepository;

  constructor() {
    this.repository = new VendorRepository();
    this.permissionRepository = new VendorPermissionRepository();
    this.productRepository = new ProductRepository();
    this.documentRepository = new VendorDocumentRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN");
    }
  }

  async createVendor(
    role: UserRole,
    data: Pick<Vendor, "name" | "phone" | "city" | "district" | "address">
  ): Promise<Vendor> {
    this.assertSudo(role);

    const vendor: Omit<Vendor, "_id"> = {
      name: data.name,
      phone: data.phone,
      city: data.city,
      district: data.district,
      address: data.address,
      createdAt: Timestamp.now(),
    };

    return await this.repository.create(vendor);
  }

  async getVendor(id: string): Promise<Vendor> {
    const vendor = await this.repository.findById(id);

    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    return vendor;
  }

  /**
   * List all vendors (for management/sudo)
   */
  async listAllVendors(): Promise<Vendor[]> {
    return await this.repository.findAll();
  }

  /**
   * List vendors that company has permission to see (for client)
   */
  async listVendorsForCompany(companyId: string): Promise<Vendor[]> {
    // Get vendor IDs that this company has permission for
    const vendorIds = await this.permissionRepository.getVendorIdsForCompany(companyId);

    if (vendorIds.length === 0) {
      return [];
    }

    return await this.repository.findByIds(vendorIds);
  }

  async updateVendor(
    role: UserRole,
    id: string,
    updates: Partial<Pick<Vendor, "name" | "phone" | "city" | "district" | "address">>
  ): Promise<Vendor> {
    this.assertSudo(role);

    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const updated = await this.repository.update(id, updates);

    if (!updated) {
      throw new AppError(500, "Failed to update vendor", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteVendor(role: UserRole, id: string): Promise<void> {
    this.assertSudo(role);

    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Delete vendor and cascade delete related data
    await Promise.all([
      this.repository.delete(id),
      this.permissionRepository.removeAllPermissionsForVendor(id),
      this.productRepository.deleteByVendorId(id),
      this.documentRepository.deleteByVendorId(id),
    ]);

    logger.info("Vendor deleted with cascade", { vendorId: id });
  }

  // ========== PERMISSION MANAGEMENT ==========

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

  // ========== DOCUMENT MANAGEMENT ==========

  /**
   * Upload a document for a vendor (sudo only)
   */
  async uploadDocument(
    role: UserRole,
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
    this.assertSudo(role);

    const vendorExists = await this.repository.exists(vendorId);
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

    const created = await this.documentRepository.create(documentData as any, vendorId);

    // Return metadata without binary data
    const { data, ...metadata } = created;
    return metadata;
  }

  /**
   * Get latest document for a vendor (for client)
   */
  async getLatestDocument(vendorId: string): Promise<{ metadata: VendorDocumentMetadata; buffer: Buffer } | null> {
    const document = await this.documentRepository.findLatestByVendorId(vendorId);

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
   * Get latest document metadata for a vendor (for client)
   */
  async getLatestDocumentMetadata(vendorId: string): Promise<VendorDocumentMetadata | null> {
    return await this.documentRepository.findLatestMetadataByVendorId(vendorId);
  }

  /**
   * Get all documents for a vendor (for management)
   */
  async getAllDocuments(role: UserRole, vendorId: string): Promise<VendorDocumentMetadata[]> {
    this.assertSudo(role);
    return await this.documentRepository.findAllByVendorId(vendorId);
  }

  /**
   * Get document binary for download
   */
  async getDocumentData(documentId: string): Promise<{ metadata: VendorDocumentMetadata; buffer: Buffer }> {
    const document = await this.documentRepository.findById(documentId);

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
   * Delete a document (sudo only)
   */
  async deleteDocument(role: UserRole, documentId: string): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.documentRepository.delete(documentId);
    if (!deleted) {
      throw new AppError(404, "Document not found", "DOCUMENT_NOT_FOUND");
    }

    logger.info("Vendor document deleted", { documentId });
  }
}

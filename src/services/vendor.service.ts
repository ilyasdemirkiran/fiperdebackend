import { VendorRepository } from "@/repositories/vendor.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { VendorAttachmentRepository } from "@/repositories/vendor-attachment.repository";
import type { Vendor } from "@/types/vendor/vendor";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import type { UserRole } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";

export class VendorService {
  private repository: VendorRepository;
  private permissionRepository: VendorPermissionRepository;
  private productRepository: ProductRepository;
  private attachmentRepository: VendorAttachmentRepository;

  constructor() {
    this.repository = new VendorRepository();
    this.permissionRepository = new VendorPermissionRepository();
    this.productRepository = new ProductRepository();
    this.attachmentRepository = new VendorAttachmentRepository();
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

    // Omit _id - MongoDB will auto-generate ObjectId
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

  async listAllVendors(): Promise<Vendor[]> {
    return await this.repository.findAll();
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
      this.attachmentRepository.deleteByVendorId(id),
    ]);

    logger.info("Vendor deleted with cascade", { vendorId: id });
  }

  // Permission Management

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
}

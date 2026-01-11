import { ManagementRepository } from "@/repositories/management.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { ProductRepository } from "@/repositories/product.repository";
import type { CompanyWithUsers, VendorWithProducts } from "@/types/management/management";
import type { Vendor } from "@/types/vendor/vendor";
import type { Product } from "@/types/vendor/product/product";
import type { UserRole } from "@/types/user/fi_user";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";

export class ManagementService {
  private repository: ManagementRepository;
  private vendorRepo: VendorRepository;
  private productRepo: ProductRepository;

  constructor() {
    this.repository = new ManagementRepository();
    this.vendorRepo = new VendorRepository();
    this.productRepo = new ProductRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Bu işlem için sudo yetkisi gerekli", "FORBIDDEN");
    }
  }

  // =====================
  // COMPANY MANAGEMENT
  // =====================

  async listCompaniesWithUsers(role: UserRole): Promise<CompanyWithUsers[]> {
    this.assertSudo(role);

    const companies = await this.repository.findAllCompanies();

    const companiesWithUsers: CompanyWithUsers[] = await Promise.all(
      companies.map(async (company) => {
        const users = await this.repository.findUsersByIds(company.userIds);
        return { ...company, users };
      })
    );

    return companiesWithUsers;
  }

  async promoteToAdmin(role: UserRole, companyId: string, userId: string): Promise<void> {
    this.assertSudo(role);

    await this.repository.updateUserRole(userId, "admin");
    logger.info("User promoted to admin", { companyId, userId });
  }

  async demoteFromAdmin(role: UserRole, companyId: string, userId: string): Promise<void> {
    this.assertSudo(role);

    await this.repository.updateUserRole(userId, "user");
    logger.info("User demoted from admin", { companyId, userId });
  }

  // =====================
  // VENDOR MANAGEMENT
  // =====================

  async listVendors(role: UserRole): Promise<Vendor[]> {
    this.assertSudo(role);

    return await this.repository.findAllVendors();
  }

  async getVendorWithProducts(role: UserRole, vendorId: string): Promise<VendorWithProducts> {
    this.assertSudo(role);

    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const products = await this.repository.findProductsByVendorId(vendorId);

    return { ...vendor, products };
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
      allowedCompanyIds: [],
      createdAt: Timestamp.now(),
    };

    return await this.vendorRepo.create(vendor);
  }

  async updateVendor(
    role: UserRole,
    vendorId: string,
    data: Partial<Pick<Vendor, "name" | "phone" | "city" | "district" | "address">>
  ): Promise<Vendor> {
    this.assertSudo(role);

    const updated = await this.vendorRepo.update(vendorId, data);
    if (!updated) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    return updated;
  }

  async deleteVendor(role: UserRole, vendorId: string): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.vendorRepo.delete(vendorId);
    if (!deleted) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    logger.info("Vendor deleted", { vendorId });
  }

  async setVendorAccess(role: UserRole, vendorId: string, companyIds: string[]): Promise<void> {
    this.assertSudo(role);

    await this.repository.updateVendorAccess(vendorId, companyIds);
  }

  async updateVendorPdfUrl(role: UserRole, vendorId: string, pdfUrl: string): Promise<void> {
    this.assertSudo(role);

    await this.repository.updateVendorPdfUrl(vendorId, pdfUrl);
  }

  // =====================
  // PRODUCT MANAGEMENT
  // =====================

  async createProduct(
    role: UserRole,
    vendorId: string,
    data: Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">
  ): Promise<Product> {
    this.assertSudo(role);

    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const product: Omit<Product, "_id"> = {
      ...data,
      vendorId,
      vendorName: vendor.name,
      createdAt: Timestamp.now(),
    };

    return await this.productRepo.create(product);
  }

  async updateProduct(
    role: UserRole,
    productId: string,
    data: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">>
  ): Promise<Product> {
    this.assertSudo(role);

    const updated = await this.productRepo.update(productId, data);
    if (!updated) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    return updated;
  }

  async deleteProduct(role: UserRole, productId: string): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.productRepo.delete(productId);
    if (!deleted) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    logger.info("Product deleted", { productId });
  }
}

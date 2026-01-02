import { ProductRepository } from "@/repositories/product.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { Product } from "@/types/vendor/product/product";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { UserRole } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";

export class ProductService {
  private repository: ProductRepository;
  private vendorRepository: VendorRepository;
  private permissionRepository: VendorPermissionRepository;

  constructor() {
    this.repository = new ProductRepository();
    this.vendorRepository = new VendorRepository();
    this.permissionRepository = new VendorPermissionRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN");
    }
  }

  /**
   * KEY METHOD: List products that user's company can access
   * Uses permission system to filter vendors
   */
  async listProductsForCompany(companyId: string): Promise<Product[]> {
    // Get allowed vendor IDs for this company
    const allowedVendorIds = await this.permissionRepository.getVendorIdsForCompany(companyId);

    if (allowedVendorIds.length === 0) {
      return [];
    }

    // Fetch products from allowed vendors
    return await this.repository.findByVendorIds(allowedVendorIds);
  }

  async createProduct(
    role: UserRole,
    data: Pick<Product, "name" | "code" | "price" | "currency" | "vendorId" | "description" | "imageUrl">
  ): Promise<Product> {
    this.assertSudo(role);

    // Verify vendor exists
    const vendorExists = await this.vendorRepository.exists(data.vendorId);
    if (!vendorExists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const id = crypto.randomUUID();

    const product: Product = {
      id,
      name: data.name,
      code: data.code,
      price: data.price,
      currency: data.currency,
      vendorId: data.vendorId,
      description: data.description,
      imageUrl: data.imageUrl,
      createdAt: Timestamp.now(),
    };

    return await this.repository.create(product);
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    return product;
  }

  async listAllProducts(): Promise<Product[]> {
    return await this.repository.findAll();
  }

  async listProductsByVendor(vendorId: string): Promise<Product[]> {
    return await this.repository.findByVendorId(vendorId);
  }

  async updateProduct(
    role: UserRole,
    id: string,
    updates: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description" | "imageUrl">>
  ): Promise<Product> {
    this.assertSudo(role);

    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    const updated = await this.repository.update(id, {
      ...updates,
      updatedAt: Timestamp.now(),
    });

    if (!updated) {
      throw new AppError(500, "Failed to update product", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteProduct(role: UserRole, id: string): Promise<void> {
    this.assertSudo(role);

    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new AppError(500, "Failed to delete product", "DELETE_FAILED");
    }

    logger.info("Product deleted successfully", { productId: id });
  }
}

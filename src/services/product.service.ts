import { ProductRepository } from "@/repositories/product.repository";
import { VendorPermissionRepository } from "@/repositories/vendor-permission.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { VendorPriceRateRepository } from "@/repositories/vendor-price-rate.repository";
import type { Product } from "@/types/vendor/product/product";
import type { Vendor } from "@/types/vendor/vendor";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import type { UserRole } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import { ObjectId } from "mongodb";

export class ProductService {
  private repository: ProductRepository;
  private vendorRepository: VendorRepository;
  private permissionRepository: VendorPermissionRepository;
  private priceRateRepository: VendorPriceRateRepository;

  constructor() {
    this.repository = new ProductRepository();
    this.vendorRepository = new VendorRepository();
    this.permissionRepository = new VendorPermissionRepository();
    this.priceRateRepository = new VendorPriceRateRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN");
    }
  }

  /**
   * Build a vendorId → rate map for a company's allowed vendors.
   * Vendors without an explicit rate entry default to 0.
   */
  private async buildRateMap(vendorIds: string[]): Promise<Map<string, number>> {
    const objectIds = vendorIds.map((id) => new ObjectId(id));
    const rates = await this.priceRateRepository.findByVendorIds(objectIds);
    const map = new Map<string, number>();
    for (const r of rates) {
      map.set(r.vendorId.toHexString(), r.rate);
    }
    return map;
  }

  /**
   * Apply priceWithRate to a list of enriched products using the rate map.
   */
  private applyRates(
    products: (Product & { vendor?: Vendor })[],
    rateMap: Map<string, number>
  ): Product[] {
    return products.map((p) => {
      const vendorHex = p.vendorId?.toHexString?.() ?? p.vendorId?.toString?.() ?? "";
      const rate = rateMap.get(vendorHex) ?? 0;
      return {
        ...p,
        priceWithRate: parseFloat((p.price * (1 + rate / 100)).toFixed(2)),
      } as Product;
    });
  }

  /**
   * KEY METHOD: List products that user's company can access
   * Uses permission system to filter vendors, joins vendor doc, applies price rates.
   */
  async listProductsForCompany(companyId: string): Promise<Product[]> {
    // Get allowed vendor IDs for this company
    const allowedVendorIds = await this.permissionRepository.getVendorIdsForCompany(companyId);

    if (allowedVendorIds.length === 0) {
      return [];
    }

    const objectIds = allowedVendorIds.map((id) => new ObjectId(id));

    // Parallel: fetch enriched products + rate map
    const [products, rateMap] = await Promise.all([
      this.repository.findEnrichedByVendorIds(objectIds),
      this.buildRateMap(allowedVendorIds),
    ]);

    return this.applyRates(products, rateMap);
  }

  async createProduct(
    role: UserRole,
    data: {
      name: string;
      code: string;
      price: number;
      currency: "TRY" | "USD" | "EUR";
      vendorId: string;
      description?: string;
      imageUrl?: string;
    }
  ): Promise<Product> {
    this.assertSudo(role);

    // Verify vendor exists
    const vendorExists = await this.vendorRepository.exists(data.vendorId);
    if (!vendorExists) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Omit _id and vendorId - repository will add vendorId as ObjectId
    const productData: Omit<Product, "_id" | "vendorId"> = {
      name: data.name,
      code: data.code,
      price: data.price,
      currency: data.currency,
      description: data.description,
      imageUrl: data.imageUrl,
      createdAt: Timestamp.now(),
    };

    return await this.repository.create(productData as any, data.vendorId);
  }

  async getProduct(id: string, companyId?: string): Promise<Product> {
    const product = await this.repository.findEnrichedById(id);

    if (!product) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    if (companyId) {
      const vendorHex = product.vendorId?.toHexString?.() ?? product.vendorId?.toString?.() ?? "";
      const rateMap = await this.buildRateMap([vendorHex]);
      const enriched = this.applyRates([product], rateMap)[0];
      return enriched!;
    }

    return product;
  }

  async listAllProducts(): Promise<Product[]> {
    return await this.repository.findAll();
  }

  async listProductsByVendor(vendorId: string, companyId?: string): Promise<Product[]> {
    const products = await this.repository.findEnrichedByVendorId(vendorId);

    if (companyId && products.length > 0) {
      const rateMap = await this.buildRateMap([vendorId]);
      return this.applyRates(products, rateMap);
    }

    return products;
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

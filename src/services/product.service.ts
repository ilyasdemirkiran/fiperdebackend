import { ProductRepository } from "@/repositories/product.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { VendorPriceRateRepository } from "@/repositories/vendor-price-rate.repository";
import type { Product } from "@/types/vendor/product/product";
import type { Vendor } from "@/types/vendor/vendor";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { ObjectId } from "mongodb";

export class ProductService {
  private repository: ProductRepository;
  private vendorRepository: VendorRepository;
  private priceRateRepository: VendorPriceRateRepository;

  constructor() {
    this.repository = new ProductRepository();
    this.vendorRepository = new VendorRepository();
    this.priceRateRepository = new VendorPriceRateRepository();
  }

  /**
   * Build a vendorId → rate map for a company's vendors.
   * Vendors without an explicit rate entry default to 0.
   */
  private async buildRateMap(companyId: string, vendorIds: string[]): Promise<Map<string, number>> {
    if (vendorIds.length === 0) return new Map();
    const objectIds = vendorIds.map((id) => new ObjectId(id));
    const rates = await this.priceRateRepository.findByVendorIds(companyId, objectIds);
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
      const vendorHex = p.vendorId ? (p.vendorId.toHexString?.() ?? p.vendorId.toString?.() ?? "") : "";
      const rate = vendorHex ? (rateMap.get(vendorHex) ?? 0) : 0;
      return {
        ...p,
        priceWithRate: parseFloat((p.price * (1 + rate / 100)).toFixed(2)),
      } as Product;
    });
  }

  /**
   * List all products for a company from its own database with vendor joined and price rates applied
   */
  async listProductsForCompany(companyId: string): Promise<Product[]> {
    const [products, vendors] = await Promise.all([
      this.repository.findEnrichedAll(companyId),
      this.vendorRepository.findAll(companyId),
    ]);

    if (products.length === 0) {
      return [];
    }

    const vendorIds = vendors.map((v) => v._id!.toString());
    const rateMap = await this.buildRateMap(companyId, vendorIds);

    return this.applyRates(products, rateMap);
  }

  /**
   * List all plain products for a company without enriched fields
   */
  async listAllProductsForCompany(companyId: string): Promise<Product[]> {
    const [products, vendors] = await Promise.all([
      this.repository.findAll(companyId),
      this.vendorRepository.findAll(companyId),
    ]);

    if (products.length === 0) {
      return [];
    }

    const vendorIds = vendors.map((v) => v._id!.toString());
    const rateMap = await this.buildRateMap(companyId, vendorIds);

    return this.applyRates(products as any, rateMap);
  }

  /**
   * Create a product in company's database (vendorId is optional)
   */
  async createProduct(
    companyId: string,
    data: {
      name: string;
      code: string;
      price: number;
      currency: "TRY" | "USD" | "EUR";
      vendorId?: string;
      description?: string;
    }
  ): Promise<Product> {
    let vendorName: string | undefined;

    // Verify vendor exists in company database if vendorId is provided
    if (data.vendorId) {
      const vendor = await this.vendorRepository.findById(data.vendorId, companyId);
      if (!vendor) {
        throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
      }
      vendorName = vendor.name;
    }

    const productData: Omit<Product, "_id" | "vendorId"> & { vendorName?: string } = {
      name: data.name,
      code: data.code,
      price: data.price,
      currency: data.currency,
      vendorName,
      description: data.description,
      createdAt: Timestamp.now(),
    };

    return await this.repository.create(productData as any, data.vendorId, companyId);
  }

  /**
   * Get single product from company database
   */
  async getProduct(companyId: string, id: string): Promise<Product> {
    const product = await this.repository.findEnrichedById(id, companyId);

    if (!product) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    const vendorHex = product.vendorId ? (product.vendorId.toHexString?.() ?? product.vendorId.toString?.() ?? "") : "";
    const rateMap = vendorHex ? await this.buildRateMap(companyId, [vendorHex]) : new Map();
    const enriched = this.applyRates([product], rateMap)[0];
    return enriched!;
  }

  /**
   * List products by vendor for a company
   */
  async listProductsByVendor(companyId: string, vendorId: string): Promise<Product[]> {
    const products = await this.repository.findByVendorId(vendorId, companyId);

    if (products.length > 0) {
      const rateMap = await this.buildRateMap(companyId, [vendorId]);
      return this.applyRates(products, rateMap);
    }

    return products;
  }

  /**
   * Update product in company database
   */
  async updateProduct(
    companyId: string,
    id: string,
    updates: Partial<Pick<Product, "name" | "code" | "price" | "currency" | "description">> & {
      vendorId?: string | ObjectId;
    }
  ): Promise<Product> {
    const exists = await this.repository.exists(id, companyId);
    if (!exists) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    let vendorName: string | undefined;
    if (updates.vendorId) {
      const vendor = await this.vendorRepository.findById(updates.vendorId.toString(), companyId);
      if (!vendor) {
        throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
      }
      vendorName = vendor.name;
    }

    const updatePayload: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    if (updates.vendorId) {
      updatePayload.vendorId = new ObjectId(updates.vendorId.toString());
      updatePayload.vendorName = vendorName;
    }

    const updated = await this.repository.update(id, updatePayload, companyId);

    if (!updated) {
      throw new AppError(500, "Failed to update product", "UPDATE_FAILED");
    }

    return updated;
  }

  /**
   * Delete product in company database
   */
  async deleteProduct(companyId: string, id: string): Promise<void> {
    const exists = await this.repository.exists(id, companyId);
    if (!exists) {
      throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    }

    const deleted = await this.repository.delete(id, companyId);

    if (!deleted) {
      throw new AppError(500, "Failed to delete product", "DELETE_FAILED");
    }

    logger.info("Product deleted successfully", { productId: id, companyId });
  }
}

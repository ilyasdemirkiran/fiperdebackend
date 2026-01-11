import { Collection } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { Product } from "@/types/vendor/product/product";
import { logger } from "@/utils/logger";

export class ProductRepository {
  private getCollection(): Collection<Product> {
    const db = getGlobalVendorDatabase();
    return db.collection<Product>("products");
  }

  async create(product: Product): Promise<Product> {
    try {
      const collection = this.getCollection();
      await collection.insertOne(product as any);
      logger.info("Product created", { productId: product._id, vendorId: product.vendorId });
      return product;
    } catch (error) {
      logger.error("Failed to create product", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: id } as any);
    } catch (error) {
      logger.error("Failed to find product by ID", error);
      throw error;
    }
  }

  /**
   * KEY METHOD: Find products by allowed vendor IDs
   * Used when company requests product list
   */
  async findByVendorIds(vendorIds: string[]): Promise<Product[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: { $in: vendorIds } } as any)
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor IDs", error);
      throw error;
    }
  }

  async findByVendorId(vendorId: string): Promise<Product[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId } as any)
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor ID", error);
      throw error;
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({})
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all products", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Product>): Promise<Product | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOneAndUpdate(
        { _id: id } as any,
        { $set: updates },
        { returnDocument: "after" }
      );
    } catch (error) {
      logger.error("Failed to update product", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: id } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Product deleted", { productId: id });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete product", error);
      throw error;
    }
  }

  async deleteByVendorId(vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteMany({ vendorId } as any);
      logger.info("Products deleted for vendor", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete products by vendor ID", error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({ _id: id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check product existence", error);
      throw error;
    }
  }
}

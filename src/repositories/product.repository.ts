import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { Product } from "@/types/vendor/product/product";
import { logger } from "@/utils/logger";

export class ProductRepository {
  private getCollection(): Collection<Product> {
    const db = getGlobalVendorDatabase();
    return db.collection<Product>("products");
  }

  async create(product: Omit<Product, "_id">, vendorId: string): Promise<Product> {
    try {
      const collection = this.getCollection();
      const productToInsert = {
        ...product,
        vendorId: new ObjectId(vendorId),
      };
      const result = await collection.insertOne(productToInsert as any);
      logger.info("Product created", { productId: result.insertedId, vendorId });
      return { ...productToInsert, _id: result.insertedId };
    } catch (error) {
      logger.error("Failed to create product", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: new ObjectId(id) });
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
      const objectIds = vendorIds.map(id => new ObjectId(id));
      return await collection
        .find({ vendorId: { $in: objectIds } })
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
        .find({ vendorId: new ObjectId(vendorId) })
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
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
      );
    } catch (error) {
      logger.error("Failed to update product", error);
      throw error;
    }
  }

  async bulkUpdate(
    updates: { productId: string; data: Partial<Product> }[],
    vendorId: string
  ): Promise<number> {
    try {
      const collection = this.getCollection();
      const bulkOps = updates.map(({ productId, data }) => ({
        updateOne: {
          filter: { _id: new ObjectId(productId), vendorId: new ObjectId(vendorId) },
          update: { $set: data },
        },
      }));
      const result = await collection.bulkWrite(bulkOps);
      logger.info("Products bulk updated", { count: result.modifiedCount, vendorId });
      return result.modifiedCount;
    } catch (error) {
      logger.error("Failed to bulk update products", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
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
      const result = await collection.deleteMany({ vendorId: new ObjectId(vendorId) });
      logger.info("Products deleted for vendor", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete products by vendor ID", error);
      throw error;
    }
  }

  async bulkCreate(products: Omit<Product, "_id">[], vendorId: string): Promise<Product[]> {
    try {
      const collection = this.getCollection();
      const productsToInsert = products.map((p) => ({
        ...p,
        vendorId: new ObjectId(vendorId),
      }));
      const result = await collection.insertMany(productsToInsert as any);
      logger.info("Products bulk created", { count: result.insertedCount, vendorId });
      return productsToInsert.map((p, i) => ({ ...p, _id: result.insertedIds[i] }));
    } catch (error) {
      logger.error("Failed to bulk create products", error);
      throw error;
    }
  }

  async bulkDelete(productIds: string[], vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const objectIds = productIds.map((id) => new ObjectId(id));
      const result = await collection.deleteMany({
        _id: { $in: objectIds },
        vendorId: new ObjectId(vendorId),
      });
      logger.info("Products bulk deleted", { count: result.deletedCount, vendorId });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to bulk delete products", error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({ _id: new ObjectId(id) });
      return count > 0;
    } catch (error) {
      logger.error("Failed to check product existence", error);
      throw error;
    }
  }
}

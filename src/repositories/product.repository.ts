import { Collection, ObjectId } from "mongodb";
import { getDatabaseForCompany, getGlobalVendorDatabase } from "@/config/database";
import type { Product } from "@/types/vendor/product/product";
import type { Vendor } from "@/types/vendor/vendor";
import { logger } from "@/utils/logger";
import { getCompanyProductsCollection, getProductsCollection } from "@/repositories/collections/core.collections";

export class ProductRepository {
  private getCollection(companyId?: string): Collection<Product> {
    if (companyId) {
      return getCompanyProductsCollection(companyId);
    }
    return getProductsCollection();
  }

  private getDatabase(companyId?: string) {
    if (companyId) {
      return getDatabaseForCompany(companyId);
    }
    return getGlobalVendorDatabase();
  }

  async create(product: Omit<Product, "_id">, vendorId?: string, companyId?: string): Promise<Product> {
    try {
      const collection = this.getCollection(companyId);
      const productToInsert: any = {
        ...product,
      };
      if (vendorId) {
        productToInsert.vendorId = new ObjectId(vendorId);
      }
      const result = await collection.insertOne(productToInsert as any);
      logger.info("Product created", { productId: result.insertedId, vendorId, companyId });
      return { ...productToInsert, _id: result.insertedId };
    } catch (error) {
      logger.error("Failed to create product", error);
      throw error;
    }
  }

  async findById(id: string, companyId?: string): Promise<Product | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Failed to find product by ID", error);
      throw error;
    }
  }

  async findAll(companyId?: string): Promise<Product[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.find({}).sort({ name: 1 }).toArray();
    } catch (error) {
      logger.error("Failed to fetch all products", error);
      throw error;
    }
  }

  async findByVendorIds(vendorIds: string[], companyId?: string): Promise<Product[]> {
    try {
      const collection = this.getCollection(companyId);
      const objectIds = vendorIds.map((id) => new ObjectId(id));
      return await collection
        .find({ vendorId: { $in: objectIds } })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor IDs", error);
      throw error;
    }
  }

  async findByVendorId(vendorId: string, companyId?: string): Promise<Product[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find({ vendorId: new ObjectId(vendorId) })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor ID", error);
      throw error;
    }
  }

  // ========== ENRICHED (AGGREGATION) METHODS ==========

  async findEnrichedByVendorIds(vendorIds: ObjectId[], companyId?: string): Promise<(Product & { vendor?: Vendor })[]> {
    try {
      const db = this.getDatabase(companyId);
      return await db
        .collection<Product>("products")
        .aggregate<Product & { vendor?: Vendor }>([
          { $match: { vendorId: { $in: vendorIds } } },
          {
            $lookup: {
              from: "vendors",
              localField: "vendorId",
              foreignField: "_id",
              as: "vendorArr",
            },
          },
          {
            $addFields: {
              vendor: { $arrayElemAt: ["$vendorArr", 0] },
            },
          },
          { $unset: "vendorArr" },
          { $sort: { name: 1 } },
        ])
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch enriched products by vendor IDs", error);
      throw error;
    }
  }

  async findEnrichedAll(companyId?: string): Promise<(Product & { vendor?: Vendor })[]> {
    try {
      const db = this.getDatabase(companyId);
      return await db
        .collection<Product>("products")
        .aggregate<Product & { vendor?: Vendor }>([
          {
            $lookup: {
              from: "vendors",
              localField: "vendorId",
              foreignField: "_id",
              as: "vendorArr",
            },
          },
          {
            $addFields: {
              vendor: { $arrayElemAt: ["$vendorArr", 0] },
            },
          },
          { $unset: "vendorArr" },
          { $sort: { name: 1 } },
        ])
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all enriched products", error);
      throw error;
    }
  }

  async findEnrichedById(id: string, companyId?: string): Promise<(Product & { vendor?: Vendor }) | null> {
    try {
      const db = this.getDatabase(companyId);
      const result = await db
        .collection<Product>("products")
        .aggregate<Product & { vendor?: Vendor }>([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: "vendors",
              localField: "vendorId",
              foreignField: "_id",
              as: "vendorArr",
            },
          },
          {
            $addFields: {
              vendor: { $arrayElemAt: ["$vendorArr", 0] },
            },
          },
          { $unset: "vendorArr" },
        ])
        .toArray();
      return result[0] ?? null;
    } catch (error) {
      logger.error("Failed to fetch enriched product by ID", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Product>, companyId?: string): Promise<Product | null> {
    try {
      const collection = this.getCollection(companyId);
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
    vendorId?: string,
    companyId?: string
  ): Promise<number> {
    try {
      const collection = this.getCollection(companyId);
      const bulkOps = updates.map(({ productId, data }) => {
        const filter: any = { _id: new ObjectId(productId) };
        if (vendorId) {
          filter.vendorId = new ObjectId(vendorId);
        }
        return {
          updateOne: {
            filter,
            update: { $set: data },
          },
        };
      });
      const result = await collection.bulkWrite(bulkOps);
      logger.info("Products bulk updated", { count: result.modifiedCount, vendorId, companyId });
      return result.modifiedCount;
    } catch (error) {
      logger.error("Failed to bulk update products", error);
      throw error;
    }
  }

  async delete(id: string, companyId?: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Product deleted", { productId: id, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete product", error);
      throw error;
    }
  }

  async deleteByVendorId(vendorId: string, companyId?: string): Promise<number> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteMany({ vendorId: new ObjectId(vendorId) });
      logger.info("Products deleted for vendor", { vendorId, count: result.deletedCount, companyId });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete products by vendor ID", error);
      throw error;
    }
  }

  async bulkCreate(products: Omit<Product, "_id">[], vendorId?: string, companyId?: string): Promise<Product[]> {
    try {
      if (products.length === 0) return [];
      const collection = this.getCollection(companyId);
      const productsToInsert = products.map((p) => {
        const item: any = { ...p };
        if (vendorId) {
          item.vendorId = new ObjectId(vendorId);
        }
        return item;
      });
      const result = await collection.insertMany(productsToInsert as any);
      logger.info("Products bulk created", { count: result.insertedCount, vendorId, companyId });
      return productsToInsert.map((p, i) => ({ ...p, _id: result.insertedIds[i] }));
    } catch (error) {
      logger.error("Failed to bulk create products", error);
      throw error;
    }
  }

  async bulkDelete(productIds: string[], vendorId?: string, companyId?: string): Promise<number> {
    try {
      const collection = this.getCollection(companyId);
      const objectIds = productIds.map((id) => new ObjectId(id));
      const filter: any = { _id: { $in: objectIds } };
      if (vendorId) {
        filter.vendorId = new ObjectId(vendorId);
      }
      const result = await collection.deleteMany(filter);
      logger.info("Products bulk deleted", { count: result.deletedCount, vendorId, companyId });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to bulk delete products", error);
      throw error;
    }
  }

  async exists(id: string, companyId?: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ _id: new ObjectId(id) });
      return count > 0;
    } catch (error) {
      logger.error("Failed to check product existence", error);
      throw error;
    }
  }
}

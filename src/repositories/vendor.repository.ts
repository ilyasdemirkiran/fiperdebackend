import { Collection } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { Vendor } from "@/types/vendor/vendor";
import { logger } from "@/utils/logger";

export class VendorRepository {
  private getCollection(): Collection<Vendor> {
    const db = getGlobalVendorDatabase();
    return db.collection<Vendor>("vendors");
  }

  async create(vendor: Vendor): Promise<Vendor> {
    try {
      const collection = this.getCollection();
      await collection.insertOne(vendor as any);
      logger.info("Vendor created", { vendorId: vendor._id });
      return vendor;
    } catch (error) {
      logger.error("Failed to create vendor", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Vendor | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: id } as any, { projection: { _id: 0 } });
    } catch (error) {
      logger.error("Failed to find vendor by ID", error);
      throw error;
    }
  }

  async findAll(): Promise<Vendor[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({}, { projection: { _id: 0 } })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all vendors", error);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ _id: { $in: ids } } as any, { projection: { _id: 0 } })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch vendors by IDs", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Vendor>): Promise<Vendor | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOneAndUpdate(
        { _id: id } as any,
        { $set: updates },
        { returnDocument: "after", projection: { _id: 0 } }
      );
    } catch (error) {
      logger.error("Failed to update vendor", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: id } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Vendor deleted", { vendorId: id });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete vendor", error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({ _id: id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check vendor existence", error);
      throw error;
    }
  }
}

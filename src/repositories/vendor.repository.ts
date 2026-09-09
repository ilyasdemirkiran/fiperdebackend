import { Collection, ObjectId } from "mongodb";
import type { Vendor } from "@/types/vendor/vendor";
import { logger } from "@/utils/logger";
import { getCompanyVendorsCollection, getVendorsCollection } from "@/repositories/collections/core.collections";

export class VendorRepository {
  private getCollection(companyId?: string): Collection<Vendor> {
    if (companyId) {
      return getCompanyVendorsCollection(companyId);
    }
    return getVendorsCollection();
  }

  async create(vendor: Omit<Vendor, "_id">, companyId?: string): Promise<Vendor> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.insertOne(vendor as any);
      const created = { ...vendor, _id: result.insertedId } as Vendor;
      logger.info("Vendor created", { vendorId: result.insertedId, companyId });
      return created;
    } catch (error) {
      logger.error("Failed to create vendor", error);
      throw error;
    }
  }

  async findById(id: string, companyId?: string): Promise<Vendor | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Failed to find vendor by ID", error);
      throw error;
    }
  }

  async findAll(companyId?: string): Promise<Vendor[]> {
    try {
      return await this.getCollection(companyId)
        .find({})
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all vendors", error);
      throw error;
    }
  }

  async findByIds(ids: string[], companyId?: string): Promise<Vendor[]> {
    try {
      const collection = this.getCollection(companyId);
      const objectIds = ids.map(id => new ObjectId(id));
      return await collection
        .find({ _id: { $in: objectIds } })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch vendors by IDs", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Vendor>, companyId?: string): Promise<Vendor | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
      );
    } catch (error) {
      logger.error("Failed to update vendor", error);
      throw error;
    }
  }

  async delete(id: string, companyId?: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Vendor deleted", { vendorId: id, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete vendor", error);
      throw error;
    }
  }

  async exists(id: string, companyId?: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ _id: new ObjectId(id) });
      return count > 0;
    } catch (error) {
      logger.error("Failed to check vendor existence", error);
      throw error;
    }
  }
}

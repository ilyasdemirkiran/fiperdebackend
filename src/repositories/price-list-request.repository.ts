import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { PriceListRequest, PriceListRequestMetadata } from "@/types/vendor/price_list_request";
import { logger } from "@/utils/logger";

export class PriceListRequestRepository {
  private getCollection(): Collection<PriceListRequest> {
    const db = getGlobalVendorDatabase();
    return db.collection<PriceListRequest>("price_list_requests");
  }

  async create(request: Omit<PriceListRequest, "_id">): Promise<PriceListRequest> {
    try {
      const collection = this.getCollection();
      const result = await collection.insertOne(request as any);
      logger.info("Price list request created", {
        requestId: result.insertedId,
        vendorName: request.vendorName,
        requestedBy: request.requestedBy.name
      });
      return { ...request, _id: result.insertedId };
    } catch (error) {
      logger.error("Failed to create price list request", error);
      throw error;
    }
  }

  async findById(id: string): Promise<PriceListRequest | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Failed to find price list request by ID", error);
      throw error;
    }
  }

  async findAll(): Promise<PriceListRequestMetadata[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({})
        .project<PriceListRequestMetadata>({ data: 0 })
        .sort({ requestedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all price list requests", error);
      throw error;
    }
  }

  async findByStatus(status: 'pending' | 'completed'): Promise<PriceListRequestMetadata[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ status })
        .project<PriceListRequestMetadata>({ data: 0 })
        .sort({ requestedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch price list requests by status", error);
      throw error;
    }
  }

  async findByCompanyId(companyId: string): Promise<PriceListRequestMetadata[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ "requestedBy.companyId": new ObjectId(companyId) })
        .project<PriceListRequestMetadata>({ data: 0 })
        .sort({ requestedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch price list requests by company", error);
      throw error;
    }
  }

  async complete(
    id: string,
    completedBy: { userId: string; name: string },
    completedAt: any
  ): Promise<PriceListRequest | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'completed',
            completedBy,
            completedAt
          }
        },
        { returnDocument: "after" }
      );
    } catch (error) {
      logger.error("Failed to complete price list request", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error("Failed to delete price list request", error);
      throw error;
    }
  }
}

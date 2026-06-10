import {Collection, ObjectId} from "mongodb";
import type {VendorPriceRate} from "@/types/vendor/vendor_price_rate";
import {logger} from "@/utils/logger";
import {getVendorPriceRateCollection} from "@/repositories/collections/core.collections";

export class VendorPriceRateRepository {
  private getCollection(companyId: string): Collection<VendorPriceRate> {
    return getVendorPriceRateCollection(companyId);
  }

  /**
   * Find price rates for multiple vendors
   */
  async findByVendorIds(companyId: string, vendorIds: ObjectId[]): Promise<VendorPriceRate[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find({vendorId: {$in: vendorIds}})
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch vendor price rates", error);
      throw error;
    }
  }

  /**
   * Bulk upsert price rates — insert or update by vendorId
   */
  async bulkUpsert(companyId: string, rates: VendorPriceRate[]): Promise<void> {
    try {
      if (rates.length === 0) {
        return;
      }

      const collection = this.getCollection(companyId);
      const operations = rates.map((rate) => ({
        updateOne: {
          filter: {vendorId: new ObjectId(rate.vendorId)},
          update: {$set: {rate: rate.rate}},
          upsert: true,
        },
      }));

      await collection.bulkWrite(operations);
      logger.info("Vendor price rates bulk upserted", {count: rates.length});
    } catch (error) {
      logger.error("Failed to bulk upsert vendor price rates", error);
      throw error;
    }
  }
}

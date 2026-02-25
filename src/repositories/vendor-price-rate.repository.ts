import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { VendorPriceRate } from "@/types/vendor/vendor_price_rate";
import { logger } from "@/utils/logger";

export class VendorPriceRateRepository {
  private getCollection(): Collection<VendorPriceRate> {
    const db = getGlobalVendorDatabase();
    return db.collection<VendorPriceRate>("vendor_price_rates");
  }

  /**
   * Find price rates for multiple vendors
   */
  async findByVendorIds(vendorIds: ObjectId[]): Promise<VendorPriceRate[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: { $in: vendorIds } })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch vendor price rates", error);
      throw error;
    }
  }

  /**
   * Bulk upsert price rates — insert or update by vendorId
   */
  async bulkUpsert(rates: VendorPriceRate[]): Promise<void> {
    try {
      if (rates.length === 0) return;

      const collection = this.getCollection();
      const operations = rates.map((rate) => ({
        updateOne: {
          filter: { vendorId: new ObjectId(rate.vendorId) },
          update: { $set: { rate: rate.rate } },
          upsert: true,
        },
      }));

      await collection.bulkWrite(operations);
      logger.info("Vendor price rates bulk upserted", { count: rates.length });
    } catch (error) {
      logger.error("Failed to bulk upsert vendor price rates", error);
      throw error;
    }
  }
}

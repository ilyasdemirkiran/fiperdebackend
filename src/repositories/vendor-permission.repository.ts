import { Collection } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import { VendorPermission } from "@/types/vendor/vendor_permission";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";

export class VendorPermissionRepository {
  private getCollection(): Collection<VendorPermission> {
    const db = getGlobalVendorDatabase();
    return db.collection<VendorPermission>("vendor_permissions");
  }

  async addPermission(vendorId: string, companyId: string): Promise<VendorPermission> {
    try {
      const collection = this.getCollection();

      // Omit _id - MongoDB will auto-generate ObjectId
      const permission: Omit<VendorPermission, "_id"> = {
        vendorId,
        companyId,
        createdAt: Timestamp.now(),
      };

      const result = await collection.insertOne(permission as any);
      logger.info("Vendor permission added", { vendorId, companyId });
      return { ...permission, _id: result.insertedId } as VendorPermission;
    } catch (error) {
      logger.error("Failed to add vendor permission", error);
      throw error;
    }
  }

  async removePermission(vendorId: string, companyId: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ vendorId, companyId } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Vendor permission removed", { vendorId, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to remove vendor permission", error);
      throw error;
    }
  }

  /**
   * KEY METHOD: Get all vendor IDs that a company can access
   * Used when listing products for a company
   */
  async getVendorIdsForCompany(companyId: string): Promise<string[]> {
    try {
      const collection = this.getCollection();
      const permissions = await collection
        .find({ companyId } as any, { projection: { vendorId: 1, _id: 0 } })
        .toArray();

      return permissions.map((p) => p.vendorId);
    } catch (error) {
      logger.error("Failed to get vendor IDs for company", error);
      throw error;
    }
  }

  async getCompanyIdsForVendor(vendorId: string): Promise<string[]> {
    try {
      const collection = this.getCollection();
      const permissions = await collection
        .find({ vendorId } as any, { projection: { companyId: 1, _id: 0 } })
        .toArray();

      return permissions.map((p) => p.companyId);
    } catch (error) {
      logger.error("Failed to get company IDs for vendor", error);
      throw error;
    }
  }

  async hasPermission(vendorId: string, companyId: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({ vendorId, companyId } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check vendor permission", error);
      throw error;
    }
  }

  async removeAllPermissionsForVendor(vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteMany({ vendorId } as any);
      logger.info("All permissions removed for vendor", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to remove all permissions for vendor", error);
      throw error;
    }
  }
}

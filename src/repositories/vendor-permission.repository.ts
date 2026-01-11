import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { VendorPermission } from "@/types/vendor/vendor_permission";
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

      const permission: Omit<VendorPermission, "_id"> = {
        vendorId: new ObjectId(vendorId),
        companyId: new ObjectId(companyId),
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
      const result = await collection.deleteOne({
        vendorId: new ObjectId(vendorId),
        companyId: new ObjectId(companyId)
      });
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
        .find({ companyId: new ObjectId(companyId) }, { projection: { vendorId: 1, _id: 0 } })
        .toArray();

      return permissions.map((p) => p.vendorId.toHexString());
    } catch (error) {
      logger.error("Failed to get vendor IDs for company", error);
      throw error;
    }
  }

  async getCompanyIdsForVendor(vendorId: string): Promise<string[]> {
    try {
      const collection = this.getCollection();
      const permissions = await collection
        .find({ vendorId: new ObjectId(vendorId) }, { projection: { companyId: 1, _id: 0 } })
        .toArray();

      return permissions.map((p) => p.companyId.toHexString());
    } catch (error) {
      logger.error("Failed to get company IDs for vendor", error);
      throw error;
    }
  }

  async hasPermission(vendorId: string, companyId: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({
        vendorId: new ObjectId(vendorId),
        companyId: new ObjectId(companyId)
      });
      return count > 0;
    } catch (error) {
      logger.error("Failed to check vendor permission", error);
      throw error;
    }
  }

  async removeAllPermissionsForVendor(vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteMany({ vendorId: new ObjectId(vendorId) });
      logger.info("All permissions removed for vendor", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to remove all permissions for vendor", error);
      throw error;
    }
  }

  /**
   * Get all vendor permissions (for management dashboard)
   */
  async findAll(): Promise<Array<{ vendorId: string; companyId: string; createdAt: any }>> {
    try {
      const collection = this.getCollection();
      const permissions = await collection.find({}).toArray();
      return permissions.map((p) => ({
        vendorId: p.vendorId.toHexString(),
        companyId: p.companyId.toHexString(),
        createdAt: p.createdAt,
      }));
    } catch (error) {
      logger.error("Failed to get all vendor permissions", error);
      throw error;
    }
  }
}

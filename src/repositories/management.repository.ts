import { Collection } from "mongodb";
import { getCoreDatabase, getDatabaseForCompany } from "@/config/database";
import type { Company } from "@/types/company/company";
import type { FIUser } from "@/types/user/fi_user";
import type { Vendor } from "@/types/vendor/vendor";
import type { Product } from "@/types/vendor/product/product";
import { logger } from "@/utils/logger";

export class ManagementRepository {
  private getCompaniesCollection(): Collection<Company> {
    return getCoreDatabase().collection<Company>("companies");
  }

  private getUsersCollection(): Collection<FIUser> {
    return getCoreDatabase().collection<FIUser>("users");
  }

  private getVendorsCollection(): Collection<Vendor> {
    return getCoreDatabase().collection<Vendor>("vendors");
  }

  private getProductsCollection(): Collection<Product> {
    return getCoreDatabase().collection<Product>("products");
  }

  // Company operations
  async findAllCompanies(): Promise<Company[]> {
    try {
      return await this.getCompaniesCollection().find({}).toArray();
    } catch (error) {
      logger.error("Failed to fetch all companies", error);
      throw error;
    }
  }

  async findUsersByCompanyId(companyId: string): Promise<FIUser[]> {
    try {
      return await this.getUsersCollection()
        .find({ companyId } as any)
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch users by company", error);
      throw error;
    }
  }

  async findUsersByIds(userIds: string[]): Promise<FIUser[]> {
    try {
      return await this.getUsersCollection()
        .find({ _id: { $in: userIds } } as any)
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch users by IDs", error);
      throw error;
    }
  }

  async updateUserRole(userId: string, role: "admin" | "user"): Promise<void> {
    try {
      await this.getUsersCollection().updateOne(
        { _id: userId } as any,
        { $set: { role } }
      );
      logger.info("User role updated", { userId, role });
    } catch (error) {
      logger.error("Failed to update user role", error);
      throw error;
    }
  }

  // Vendor operations
  async findAllVendors(): Promise<Vendor[]> {
    try {
      return await this.getVendorsCollection()
        .find({})
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all vendors", error);
      throw error;
    }
  }

  async findProductsByVendorId(vendorId: string): Promise<Product[]> {
    try {
      return await this.getProductsCollection()
        .find({ vendorId } as any)
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor", error);
      throw error;
    }
  }

  async updateVendorAccess(vendorId: string, companyIds: string[]): Promise<void> {
    try {
      await this.getVendorsCollection().updateOne(
        { _id: vendorId } as any,
        { $set: { allowedCompanyIds: companyIds } }
      );
      logger.info("Vendor access updated", { vendorId, companyIds });
    } catch (error) {
      logger.error("Failed to update vendor access", error);
      throw error;
    }
  }

  async updateVendorPdfUrl(vendorId: string, pdfUrl: string): Promise<void> {
    try {
      await this.getVendorsCollection().updateOne(
        { _id: vendorId } as any,
        { $set: { pdfUrl } }
      );
      logger.info("Vendor PDF URL updated", { vendorId, pdfUrl });
    } catch (error) {
      logger.error("Failed to update vendor PDF URL", error);
      throw error;
    }
  }
}

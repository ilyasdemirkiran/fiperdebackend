import {Collection, ObjectId} from "mongodb";
import type {Company} from "@/types/company/company";
import type {FIUser} from "@/types/user/fi_user";
import type {Vendor} from "@/types/vendor/vendor";
import type {Product} from "@/types/vendor/product/product";
import {logger} from "@/utils/logger";
import {AppError} from "@/middleware/error-handler";
import {getCompaniesCollection, getProductsCollection, getUsersCollection, getVendorsCollection} from "@/repositories/collections/core.collections";

export class ManagementRepository {
  private getCompaniesCollection(): Collection<Company> {
    return getCompaniesCollection();
  }

  private getUsersCollection(): Collection<FIUser> {
    return getUsersCollection();
  }

  private getVendorsCollection(): Collection<Vendor> {
    return getVendorsCollection();
  }

  private getProductsCollection(): Collection<Product> {
    return getProductsCollection();
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

  // Note: User companyId is stored as hex string, not ObjectId
  async findUsersByCompanyId(companyId: string): Promise<FIUser[]> {
    try {
      return await this.getUsersCollection()
        .find({companyId})
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch users by company", error);
      throw error;
    }
  }

  // Note: User _id is Firebase UID (string), not ObjectId
  async findUsersByIds(userIds: string[]): Promise<FIUser[]> {
    try {
      return await this.getUsersCollection()
        .find({_id: {$in: userIds}} as any)
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch users by IDs", error);
      throw error;
    }
  }

  // Note: User _id is Firebase UID (string), not ObjectId
  async updateUserRole(userId: string, role: "admin" | "user"): Promise<void> {
    try {
      const user = await this.getUsersCollection().findOne({_id: userId} as any);
      if (!user) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      if (!user.companyId) {
        throw new AppError(403, "The selected user does not belong to any company. Please try again.", "COMPANY_NOT_FOUND");
      }

      const company = await this.getCompaniesCollection().findOne({_id: new ObjectId(user.companyId)});
      if (!company) {
        throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
      }

      if (company.creatorUserId === userId && role === "user") {
        throw new AppError(403, "You can't demote the company creator from admin", "COMPANY_CREATOR_CANNOT_BE_DEMOTED");
      }

      user.role = role;
      await this.getUsersCollection().updateOne(
        {_id: userId} as any,
        {$set: {role}}
      );
      logger.info("User role updated", {userId, role});
    } catch (error) {
      logger.error("Failed to update user role", error);
      throw error;
    }
  }

  async setUserCompanyId(userId: string, companyId: string): Promise<void> {
    try {
      const user = await this.getUsersCollection().findOne({_id: userId} as any);
      if (!user) {
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
      }

      const company = await this.getCompaniesCollection().findOne({_id: new ObjectId(companyId)});
      if (!company) {
        throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
      }

      await this.getUsersCollection().updateOne(
        {_id: userId} as any,
        {$set: {companyId}}
      );
      logger.info("User companyId set", {userId, companyId});
    } catch (error) {
      logger.error("Failed to set user companyId", error);
      throw error;
    }
  }

  // Vendor operations
  async findAllVendors(): Promise<Vendor[]> {
    try {
      return await this.getVendorsCollection()
        .find({})
        .sort({name: 1})
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch all vendors", error);
      throw error;
    }
  }

  async findProductsByVendorId(vendorId: string): Promise<Product[]> {
    try {
      return await this.getProductsCollection()
        .find({vendorId: new ObjectId(vendorId)})
        .sort({name: 1})
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch products by vendor", error);
      throw error;
    }
  }

  async findCompanyById(id: string): Promise<Company | null> {
    try {
      return await this.getCompaniesCollection().findOne({_id: new ObjectId(id)});
    } catch (error) {
      logger.error("Failed to find company by ID", error);
      throw error;
    }
  }
}
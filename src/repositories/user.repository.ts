import { Collection, ObjectId } from "mongodb";
import { getCoreDatabase } from "@/config/database";
import type { FIUser } from "@/types/user/fi_user";
import { logger } from "@/utils/logger";

export class UserRepository {
  private getCollection(): Collection<FIUser> {
    return getCoreDatabase().collection<FIUser>("users");
  }

  async create(user: FIUser): Promise<FIUser> {
    try {
      await this.getCollection().insertOne(user as any);
      logger.info("User created", { userId: user._id });
      return user;
    } catch (error) {
      logger.error("Failed to create user", error);
      throw error;
    }
  }

  async findById(_id: string): Promise<FIUser | null> {
    try {
      return await this.getCollection().findOne({ _id } as any);
    } catch (error) {
      logger.error("Failed to find user by ID", error);
      throw error;
    }
  }

  async findByPhoneNumber(phoneNumber: string): Promise<FIUser | null> {
    try {
      return await this.getCollection().findOne({ phoneNumber } as any);
    } catch (error) {
      logger.error("Failed to find user by phone number", error);
      throw error;
    }
  }

  async findByCompanyId(companyId: string): Promise<FIUser[]> {
    try {
      return await this.getCollection().find({ companyId } as any).toArray();
    } catch (error) {
      logger.error("Failed to find users by company ID", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<FIUser>): Promise<FIUser | null> {
    try {
      const result = await this.getCollection().findOneAndUpdate(
        { _id: id } as any,
        { $set: updates },
        { returnDocument: "after" }
      );
      return result as FIUser | null;
    } catch (error) {
      logger.error("Failed to update user", error);
      throw error;
    }
  }
}

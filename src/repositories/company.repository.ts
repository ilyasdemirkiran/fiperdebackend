import { Collection, ObjectId } from "mongodb";
import { getCoreDatabase } from "@/config/database";
import type { Company } from "@/types/company/company";
import { logger } from "@/utils/logger";

export class CompanyRepository {
  private getCollection(): Collection<Company> {
    return getCoreDatabase().collection<Company>("companies");
  }

  async create(company: Omit<Company, "_id">): Promise<Company> {
    try {
      const result = await this.getCollection().insertOne(company as any);
      logger.info("Company created", { companyId: result.insertedId });
      return {
        ...company,
        _id: result.insertedId
      };
    } catch (error) {
      logger.error("Failed to create company", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Company | null> {
    try {
      const doc = await this.getCollection().findOne({ _id: new ObjectId(id) } as any);
      return doc as Company | null;
    } catch (error) {
      logger.error("Failed to find company by ID", error);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<Company[]> {
    try {
      const docs = await this.getCollection()
        .find({ _id: { $in: ids.map(id => new ObjectId(id)) } } as any)
        .toArray();
      return docs as Company[];
    } catch (error) {
      logger.error("Failed to find companies by IDs", error);
      throw error;
    }
  }

  async addUser(companyId: string, userId: string): Promise<void> {
    try {
      await this.getCollection().updateOne(
        { _id: new ObjectId(companyId) } as any,
        { $addToSet: { userIds: userId } }
      );
    } catch (error) {
      logger.error("Failed to add user to company", error);
      throw error;
    }
  }

  async removeUser(companyId: string, userId: string): Promise<void> {
    try {
      await this.getCollection().updateOne(
        { _id: new ObjectId(companyId) } as any,
        { $pull: { userIds: userId } }
      );
    } catch (error) {
      logger.error("Failed to remove user from company", error);
      throw error;
    }
  }

  async update(companyId: string, updates: Partial<Company>): Promise<Company | null> {
    try {
      const result = await this.getCollection().findOneAndUpdate(
        { _id: new ObjectId(companyId) } as any,
        { $set: updates },
        { returnDocument: "after" }
      );
      return result as Company | null;
    } catch (error) {
      logger.error("Failed to update company", error);
      throw error;
    }
  }
}

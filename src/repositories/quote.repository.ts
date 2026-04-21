import { Collection, ObjectId, ClientSession } from "mongodb";
import { getDatabaseForCompany } from "@/config/database";
import type { Quote } from "@/types/quotes/quote";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";

export class QuoteRepository {
  private getCollection(companyId: string): Collection<Quote> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<Quote>("quotes");
  }

  async create(companyId: string, quote: Quote): Promise<Quote> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(quote as any);
      logger.info("Quote created", { quoteId: quote._id, companyId });
      return quote;
    } catch (error) {
      logger.error("Failed to create quote", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<Quote | null> {
    try {
      const collection = this.getCollection(companyId);
      const quote = await collection.findOne({ _id: new ObjectId(id) } as any);
      return quote;
    } catch (error) {
      logger.error("Failed to find quote by ID", error);
      throw error;
    }
  }

  async findAll(
    companyId: string,
    filter: { creatorId?: string } = {}
  ): Promise<Quote[]> {
    try {
      const collection = this.getCollection(companyId);
      const query: any = {};
      if (filter.creatorId) {
        query.creatorId = filter.creatorId;
      }
      return await collection.find(query).sort({ createdAt: -1 }).toArray();
    } catch (error) {
      logger.error("Failed to fetch quotes", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<Quote>,
    session?: ClientSession
  ): Promise<Quote | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: { ...updates, updatedAt: Timestamp.now() } },
        { returnDocument: "after", session }
      );

      if (result) {
        logger.info("Quote updated", { quoteId: id, companyId });
      }

      return result;
    } catch (error) {
      logger.error("Failed to update quote", error);
      throw error;
    }
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: new ObjectId(id) } as any);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error("Failed to delete quote", error);
      throw error;
    }
  }

  async getNextQuoteNumber(companyId: string): Promise<string> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments();
      const nextNumber = (count + 1).toString().padStart(4, "0");
      const year = new Date().getFullYear();
      return `QT-${year}-${nextNumber}`;
    } catch (error) {
      logger.error("Failed to get next quote number", error);
      throw error;
    }
  }
}

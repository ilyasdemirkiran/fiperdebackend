import { getDatabaseForCompany } from "@/config/database";
import { AppError } from "@/middleware/error-handler";
import type { QuoteItemLabel } from "@/types/quotes/quote";
import { type Collection } from "mongodb";
import {getQuoteItemLabelCollection} from "@/repositories/collections/quote.collections";



export class QuoteItemLabelRepository {

  getCollection(companyId: string): Collection<QuoteItemLabel> {
    return getQuoteItemLabelCollection(companyId);
  }

  async create(companyId: string, quoteItemLabel: QuoteItemLabel): Promise<QuoteItemLabel> {
    const collection = this.getCollection(companyId);
    const created = await collection.insertOne(quoteItemLabel);
    return { ...quoteItemLabel, id: created.insertedId.toHexString() };
  }

  async update(companyId: string, quoteItemLabel: QuoteItemLabel): Promise<QuoteItemLabel> {
    const collection = this.getCollection(companyId);

    const updated = await collection.updateOne(
      { id: quoteItemLabel.id },
      { $set: quoteItemLabel }
    );

    if (updated.matchedCount === 0) {
      throw new AppError(404, "QuoteItemLabel not found", "NOT_FOUND");
    }
    return quoteItemLabel;
  }

  async delete(companyId: string, id: string): Promise<void> {
    const collection = this.getCollection(companyId);
    const deleted = await collection.deleteOne({ id });
    if (deleted.deletedCount === 0) {
      throw new AppError(404, "QuoteItemLabel not found", "NOT_FOUND");
    }
  }

  async findById(companyId: string, id: string): Promise<QuoteItemLabel | null> {
    const collection = this.getCollection(companyId);
    return await collection.findOne({ id });
  }

  async findAll(companyId: string): Promise<QuoteItemLabel[]> {
    const collection = this.getCollection(companyId);
    return await collection.find({}).toArray();
  }
}
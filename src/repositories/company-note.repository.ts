import { Collection, ObjectId } from "mongodb";
import type { CompanyNoteDb } from "@/types/company/company_note";
import { logger } from "@/utils/logger";
import { getCompanyNotesCollection } from "@/repositories/collections/core.collections";

export class CompanyNoteRepository {
  private getCollection(): Collection<CompanyNoteDb> {
    return getCompanyNotesCollection();
  }

  async create(note: CompanyNoteDb): Promise<CompanyNoteDb> {
    try {
      const collection = this.getCollection();
      await collection.insertOne(note as any);
      logger.info("Company note created", { noteId: note._id, companyId: note.companyId });
      return note;
    } catch (error) {
      logger.error("Failed to create company note", error);
      throw error;
    }
  }

  async findById(id: string): Promise<CompanyNoteDb | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: new ObjectId(id) } as any);
    } catch (error) {
      logger.error("Failed to find company note by ID", error);
      throw error;
    }
  }

  async findByCompanyId(companyId: string): Promise<CompanyNoteDb[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ companyId: new ObjectId(companyId) } as any)
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to find company notes by company ID", error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: Partial<CompanyNoteDb>
  ): Promise<CompanyNoteDb | null> {
    try {
      const collection = this.getCollection();
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: updates },
        { returnDocument: "after" }
      );
      if (result) {
        logger.info("Company note updated", { noteId: id });
      }
      return result;
    } catch (error) {
      logger.error("Failed to update company note", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) } as any);
      const deleted = result.deletedCount > 0;
      if (deleted) {
        logger.info("Company note deleted", { noteId: id });
      }
      return deleted;
    } catch (error) {
      logger.error("Failed to delete company note", error);
      throw error;
    }
  }
}

import { ClientSession, Collection, ObjectId } from "mongodb";
import type { CustomerNoteDb } from "@/types/customer/customer_notes/customer_note";
import { logger } from "@/utils/logger";
import { getCustomerNotesCollection } from "@/repositories/collections/customer.collections";

export class CustomerNoteRepository {
  private getCollection(companyId: string): Collection<CustomerNoteDb> {
    return getCustomerNotesCollection(companyId);
  }

  async create(companyId: string, note: CustomerNoteDb): Promise<CustomerNoteDb> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(note as any);
      logger.info("Customer note created", { noteId: note._id, companyId });
      return note;
    } catch (error) {
      logger.error("Failed to create customer note", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerNoteDb | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: new ObjectId(id) } as any);
    } catch (error) {
      logger.error("Failed to find customer note by ID", error);
      throw error;
    }
  }

  async findByCustomerId(companyId: string, customerId: string): Promise<CustomerNoteDb[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find({ customerId: new ObjectId(customerId) } as any)
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to find customer notes by customer ID", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<CustomerNoteDb>
  ): Promise<CustomerNoteDb | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: updates },
        { returnDocument: "after" }
      );
      if (result) {
        logger.info("Customer note updated", { noteId: id, companyId });
      }
      return result;
    } catch (error) {
      logger.error("Failed to update customer note", error);
      throw error;
    }
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: new ObjectId(id) } as any);
      const deleted = result.deletedCount > 0;
      if (deleted) {
        logger.info("Customer note deleted", { noteId: id, companyId });
      }
      return deleted;
    } catch (error) {
      logger.error("Failed to delete customer note", error);
      throw error;
    }
  }

  async deleteAllByCustomerId(
    companyId: string,
    customerId: string,
    session?: ClientSession
  ): Promise<number> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteMany(
        { customerId: new ObjectId(customerId) } as any,
        { session }
      );
      logger.info(`Deleted ${result.deletedCount} notes for customer ${customerId}`, { companyId });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete all notes for customer", error);
      throw error;
    }
  }
}

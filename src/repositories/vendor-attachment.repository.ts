import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { VendorAttachment } from "@/types/vendor/vendor_attachment";
import { logger } from "@/utils/logger";

export class VendorAttachmentRepository {
  private getCollection(): Collection<VendorAttachment> {
    const db = getGlobalVendorDatabase();
    return db.collection<VendorAttachment>("vendor_attachments");
  }

  async create(attachment: Omit<VendorAttachment, "_id">): Promise<VendorAttachment> {
    try {
      const collection = this.getCollection();
      const result = await collection.insertOne(attachment as any);
      const created = { ...attachment, _id: result.insertedId } as VendorAttachment;
      logger.info("Vendor attachment created", { attachmentId: result.insertedId, vendorId: attachment.vendorId });
      return created;
    } catch (error) {
      logger.error("Failed to create vendor attachment", error);
      throw error;
    }
  }

  async findById(id: string): Promise<VendorAttachment | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Failed to find attachment by ID", error);
      throw error;
    }
  }

  async findByVendorId(vendorId: string): Promise<VendorAttachment[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: new ObjectId(vendorId) } as any)
        .sort({ uploadedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch attachments by vendor ID", error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<VendorAttachment>): Promise<VendorAttachment | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
      );
    } catch (error) {
      logger.error("Failed to update attachment", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Vendor attachment deleted", { attachmentId: id });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete attachment", error);
      throw error;
    }
  }

  async deleteByVendorId(vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteMany({ vendorId: new ObjectId(vendorId) } as any);
      logger.info("Attachments deleted for vendor", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete attachments by vendor ID", error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments({ _id: new ObjectId(id) } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check attachment existence", error);
      throw error;
    }
  }
}

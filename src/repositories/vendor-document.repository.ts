import { Collection, ObjectId } from "mongodb";
import { getGlobalVendorDatabase } from "@/config/database";
import type { VendorDocument, VendorDocumentMetadata } from "@/types/vendor/vendor_document";
import { logger } from "@/utils/logger";

export class VendorDocumentRepository {
  private getCollection(): Collection<VendorDocument> {
    const db = getGlobalVendorDatabase();
    return db.collection<VendorDocument>("vendor_documents");
  }

  async create(document: Omit<VendorDocument, "_id">, vendorId: string): Promise<VendorDocument> {
    try {
      const collection = this.getCollection();
      const docToInsert = {
        ...document,
        vendorId: new ObjectId(vendorId),
      };
      const result = await collection.insertOne(docToInsert as any);
      logger.info("Vendor document created", { documentId: result.insertedId, vendorId });
      return { ...docToInsert, _id: result.insertedId };
    } catch (error) {
      logger.error("Failed to create vendor document", error);
      throw error;
    }
  }

  async findById(id: string): Promise<VendorDocument | null> {
    try {
      const collection = this.getCollection();
      return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Failed to find vendor document by ID", error);
      throw error;
    }
  }

  async findAllByVendorId(vendorId: string): Promise<VendorDocumentMetadata[]> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: new ObjectId(vendorId) })
        .project<VendorDocumentMetadata>({ data: 0 })
        .sort({ uploadedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch vendor documents", error);
      throw error;
    }
  }

  async findLatestByVendorId(vendorId: string): Promise<VendorDocument | null> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: new ObjectId(vendorId) })
        .sort({ uploadedAt: -1 })
        .limit(1)
        .next();
    } catch (error) {
      logger.error("Failed to fetch latest vendor document", error);
      throw error;
    }
  }

  async findLatestMetadataByVendorId(vendorId: string): Promise<VendorDocumentMetadata | null> {
    try {
      const collection = this.getCollection();
      return await collection
        .find({ vendorId: new ObjectId(vendorId) })
        .project<VendorDocumentMetadata>({ data: 0 })
        .sort({ uploadedAt: -1 })
        .limit(1)
        .next();
    } catch (error) {
      logger.error("Failed to fetch latest vendor document metadata", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error("Failed to delete vendor document", error);
      throw error;
    }
  }

  async deleteByVendorId(vendorId: string): Promise<number> {
    try {
      const collection = this.getCollection();
      const result = await collection.deleteMany({ vendorId: new ObjectId(vendorId) });
      logger.info("Vendor documents deleted", { vendorId, count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete vendor documents", error);
      throw error;
    }
  }
}

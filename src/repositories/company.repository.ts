import {Collection, ObjectId} from "mongodb";
import type {Company} from "@/types/company/company";
import {logger} from "@/utils/logger";
import {getCompaniesCollection} from "@/repositories/collections/core.collections";
import {getGridFSBucket} from "@/config/database";
import {Readable} from "stream";

export class CompanyRepository {
  private getCollection(): Collection<Company> {
    return getCompaniesCollection();
  }

  async create(company: Omit<Company, "_id">): Promise<Company> {
    try {
      const result = await this.getCollection().insertOne(company as any);
      logger.info("Company created", {companyId: result.insertedId});
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
      const doc = await this.getCollection().findOne({_id: new ObjectId(id)} as any);
      return doc as Company | null;
    } catch (error) {
      logger.error("Failed to find company by ID", error);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<Company[]> {
    try {
      const docs = await this.getCollection()
        .find({_id: {$in: ids.map(id => new ObjectId(id))}} as any)
        .toArray();
      return docs as Company[];
    } catch (error) {
      logger.error("Failed to find companies by IDs", error);
      throw error;
    }
  }

  async findDemoCompany(): Promise<Company | null> {
    try {
      const doc = await this.getCollection().findOne({ isDemo: true } as any);
      return doc as Company | null;
    } catch (error) {
      logger.error("Failed to find demo company", error);
      throw error;
    }
  }

  async setDemoCompany(companyId: string, isDemo: boolean): Promise<Company | null> {
    try {
      // If setting a company as demo, ensure all other companies have isDemo: false (only 1 demo company allowed)
      if (isDemo) {
        await this.getCollection().updateMany(
          { _id: { $ne: new ObjectId(companyId) } } as any,
          { $set: { isDemo: false } }
        );
      }

      const result = await this.getCollection().findOneAndUpdate(
        { _id: new ObjectId(companyId) } as any,
        { $set: { isDemo } },
        { returnDocument: "after" }
      );
      return result as Company | null;
    } catch (error) {
      logger.error("Failed to set demo company", error);
      throw error;
    }
  }

  async addUser(companyId: string, userId: string): Promise<void> {
    try {
      await this.getCollection().updateOne(
        {_id: new ObjectId(companyId)} as any,
        {$addToSet: {userIds: userId}}
      );
    } catch (error) {
      logger.error("Failed to add user to company", error);
      throw error;
    }
  }

  async removeUser(companyId: string, userId: string): Promise<void> {
    try {
      await this.getCollection().updateOne(
        {_id: new ObjectId(companyId)} as any,
        {$pull: {userIds: userId}}
      );
    } catch (error) {
      logger.error("Failed to remove user from company", error);
      throw error;
    }
  }

  async update(companyId: string, updates: Partial<Company>): Promise<Company | null> {
    try {
      const result = await this.getCollection().findOneAndUpdate(
        {_id: new ObjectId(companyId)} as any,
        {$set: updates},
        {returnDocument: "after"}
      );
      return result as Company | null;
    } catch (error) {
      logger.error("Failed to update company", error);
      throw error;
    }
  }

  async delete(companyId: string): Promise<boolean> {
    try {
      const result = await this.getCollection().deleteOne({_id: new ObjectId(companyId)} as any);
      logger.info("Company deleted", {companyId});
      return result.deletedCount > 0;
    } catch (error) {
      logger.error("Failed to delete company", error);
      throw error;
    }
  }

  /**
   * Upload logo binary to GridFS of company database
   */
  async uploadLogoToGridFS(
    companyId: string,
    filename: string,
    data: Buffer,
    mimeType: string
  ): Promise<ObjectId> {
    const bucket = getGridFSBucket(companyId, "logos");

    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(data);
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { mimeType }
      });

      readableStream
        .pipe(uploadStream)
        .on("error", (error) => {
          logger.error("GridFS logo upload failed", error);
          reject(error);
        })
        .on("finish", () => {
          logger.info("GridFS logo upload completed", { fileId: uploadStream.id, filename });
          resolve(uploadStream.id);
        });
    });
  }

  /**
   * Download logo binary from GridFS of company database
   */
  async downloadLogoFromGridFS(companyId: string, fileId: ObjectId): Promise<{ buffer: Buffer; mimeType: string }> {
    const bucket = getGridFSBucket(companyId, "logos");

    const filesCollection = bucket.find({ _id: fileId });
    const fileDoc = await filesCollection.next();
    const mimeType = fileDoc?.metadata?.mimeType || "image/png";

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStream(fileId);

      downloadStream
        .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        .on("error", (error) => {
          logger.error("GridFS logo download failed", error);
          reject(error);
        })
        .on("end", () => {
          resolve({ buffer: Buffer.concat(chunks), mimeType });
        });
    });
  }

  /**
   * Delete logo binary from GridFS of company database
   */
  async deleteLogoFromGridFS(companyId: string, fileId: ObjectId): Promise<void> {
    try {
      const bucket = getGridFSBucket(companyId, "logos");
      await bucket.delete(fileId);
      logger.info("GridFS logo deleted", { fileId });
    } catch (error) {
      logger.warn("Failed to delete logo from GridFS (might already be deleted)", { fileId, error });
    }
  }
}

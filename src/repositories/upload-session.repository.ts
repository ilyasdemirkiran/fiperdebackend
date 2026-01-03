import { Collection, ObjectId, Binary, ClientSession } from "mongodb";
import { getDatabaseForCompany } from "@/config/database";
import { UploadSession, UploadChunk } from "@/types/common/upload";
import { logger } from "@/utils/logger";

export class UploadSessionRepository {
  private getSessionCollection(companyId: string): Collection<UploadSession> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<UploadSession>("upload_sessions");
  }

  private getChunkCollection(companyId: string): Collection<UploadChunk> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<UploadChunk>("upload_chunks");
  }

  async createSession(companyId: string, sessionData: UploadSession): Promise<UploadSession> {
    try {
      const collection = this.getSessionCollection(companyId);
      const result = await collection.insertOne(sessionData as any);
      sessionData._id = result.insertedId;
      return sessionData;
    } catch (error) {
      logger.error("Failed to create upload session", error);
      throw error;
    }
  }

  async getSession(companyId: string, uploadId: string): Promise<UploadSession | null> {
    try {
      const collection = this.getSessionCollection(companyId);
      return await collection.findOne({ _id: new ObjectId(uploadId) } as any);
    } catch (error) {
      logger.error("Failed to get upload session", error);
      throw error;
    }
  }

  async saveChunk(companyId: string, chunk: UploadChunk): Promise<void> {
    try {
      const collection = this.getChunkCollection(companyId);
      await collection.updateOne(
        { uploadId: chunk.uploadId, index: chunk.index },
        { $set: chunk },
        { upsert: true }
      );

      // Update session uploadedChunks list
      const sessionCollection = this.getSessionCollection(companyId);
      await sessionCollection.updateOne(
        { _id: chunk.uploadId } as any,
        {
          $addToSet: { uploadedChunks: chunk.index },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (error) {
      logger.error("Failed to save upload chunk", error);
      throw error;
    }
  }

  async getChunks(companyId: string, uploadId: ObjectId): Promise<UploadChunk[]> {
    try {
      const collection = this.getChunkCollection(companyId);
      return await collection.find({ uploadId }).sort({ index: 1 }).toArray();
    } catch (error) {
      logger.error("Failed to get upload chunks", error);
      throw error;
    }
  }

  async deleteSessionAndChunks(companyId: string, uploadId: string, session?: ClientSession): Promise<void> {
    try {
      const sessionCollection = this.getSessionCollection(companyId);
      const chunkCollection = this.getChunkCollection(companyId);
      const oid = new ObjectId(uploadId);

      await sessionCollection.deleteOne({ _id: oid } as any, { session });
      await chunkCollection.deleteMany({ uploadId: oid } as any, { session });
    } catch (error) {
      logger.error("Failed to delete upload session data", error);
      throw error;
    }
  }
}

import { Collection, ObjectId, ClientSession, GridFSBucket } from "mongodb";
import { getDatabaseForCompany, getClient, getGridFSBucket } from "@/config/database";
import type { CustomerImage, CustomerImageMetadata } from "@/types/customer/image/customer_image";
import { logger } from "@/utils/logger";
import { Readable } from "stream";

export class CustomerImageRepository {
  private getCollection(companyId: string): Collection<CustomerImage> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<CustomerImage>("customer_images");
  }

  private getCustomersCollection(companyId: string) {
    const db = getDatabaseForCompany(companyId);
    return db.collection("customers");
  }

  private getBucket(companyId: string): GridFSBucket {
    return getGridFSBucket(companyId, "images");
  }

  /**
   * Upload file to GridFS and return the file ID
   */
  async uploadToGridFS(
    companyId: string,
    filename: string,
    data: Buffer,
    metadata?: Record<string, any>
  ): Promise<ObjectId> {
    const bucket = this.getBucket(companyId);

    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(data);
      const uploadStream = bucket.openUploadStream(filename, { metadata });

      readableStream
        .pipe(uploadStream)
        .on("error", (error) => {
          logger.error("GridFS upload failed", error);
          reject(error);
        })
        .on("finish", () => {
          logger.info("GridFS upload completed", { fileId: uploadStream.id, filename });
          resolve(uploadStream.id);
        });
    });
  }

  /**
   * Download file from GridFS
   */
  async downloadFromGridFS(companyId: string, fileId: ObjectId): Promise<Buffer> {
    const bucket = this.getBucket(companyId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStream(fileId);

      downloadStream
        .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        .on("error", (error) => {
          logger.error("GridFS download failed", error);
          reject(error);
        })
        .on("end", () => {
          resolve(Buffer.concat(chunks));
        });
    });
  }

  /**
   * Get GridFS download stream for streaming response
   */
  getDownloadStream(companyId: string, fileId: ObjectId) {
    const bucket = this.getBucket(companyId);
    return bucket.openDownloadStream(fileId);
  }

  /**
   * Delete file from GridFS
   */
  async deleteFromGridFS(companyId: string, fileId: ObjectId): Promise<void> {
    const bucket = this.getBucket(companyId);
    await bucket.delete(fileId);
    logger.info("GridFS file deleted", { fileId });
  }

  /**
   * Create image metadata and upload to GridFS (transaction)
   */
  async createWithTransaction(
    companyId: string,
    customerId: string,
    imageData: {
      title: string;
      description?: string;
      filename: string;
      mimeType: string;
      data: Buffer;
      uploaderId: string;
      labels?: string[];
      uploadedAt: any;
    }
  ): Promise<CustomerImageMetadata> {
    const client = getClient();
    const session = client.startSession();
    let fileId: ObjectId | null = null;

    try {
      // First upload to GridFS (outside transaction - GridFS doesn't support transactions)
      fileId = await this.uploadToGridFS(companyId, imageData.filename, imageData.data, {
        customerId,
        mimeType: imageData.mimeType,
      });

      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        const image: CustomerImage = {
          _id: new ObjectId(),
          customerId,
          title: imageData.title,
          description: imageData.description || "",
          uploadedAt: imageData.uploadedAt,
          uploaderId: imageData.uploaderId,
          filename: imageData.filename,
          mimeType: imageData.mimeType,
          size: imageData.data.length,
          fileId: fileId!,
          labels: imageData.labels || [],
        };

        // Insert image metadata
        await imagesCollection.insertOne(image as any, { session });

        // Increment customer imageCount
        await customersCollection.updateOne(
          { _id: customerId } as any,
          { $inc: { imageCount: 1 } },
          { session }
        );
      });

      logger.info("Image created with GridFS", {
        fileId,
        customerId,
        companyId,
      });

      // Return metadata without fileId
      return {
        customerId,
        title: imageData.title,
        description: imageData.description || "",
        uploadedAt: imageData.uploadedAt,
        uploaderId: imageData.uploaderId,
        filename: imageData.filename,
        mimeType: imageData.mimeType,
        size: imageData.data.length,
        labels: imageData.labels || [],
      } as CustomerImageMetadata;
    } catch (error) {
      // Cleanup GridFS file if transaction failed
      if (fileId) {
        try {
          await this.deleteFromGridFS(companyId, fileId);
        } catch (cleanupError) {
          logger.error("Failed to cleanup GridFS file after transaction failure", cleanupError);
        }
      }
      logger.error("Failed to create image with GridFS", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create multiple images with GridFS (transaction)
   */
  async createManyWithTransaction(
    companyId: string,
    customerId: string,
    imagesData: Array<{
      title: string;
      description?: string;
      filename: string;
      mimeType: string;
      data: Buffer;
      uploaderId: string;
      labels?: string[];
      uploadedAt: any;
    }>
  ): Promise<CustomerImageMetadata[]> {
    const client = getClient();
    const session = client.startSession();
    const uploadedFileIds: ObjectId[] = [];

    try {
      // First upload all files to GridFS
      for (const imgData of imagesData) {
        const fileId = await this.uploadToGridFS(companyId, imgData.filename, imgData.data, {
          customerId,
          mimeType: imgData.mimeType,
        });
        uploadedFileIds.push(fileId);
      }

      const images: CustomerImage[] = imagesData.map((imgData, index) => ({
        _id: new ObjectId(),
        customerId,
        title: imgData.title,
        description: imgData.description || "",
        uploadedAt: imgData.uploadedAt,
        uploaderId: imgData.uploaderId,
        filename: imgData.filename,
        mimeType: imgData.mimeType,
        size: imgData.data.length,
        fileId: uploadedFileIds[index]!,
        labels: imgData.labels || [],
      }));

      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        // Insert all images
        await imagesCollection.insertMany(images as any[], { session });

        // Increment customer imageCount by number of images
        await customersCollection.updateOne(
          { _id: customerId } as any,
          { $inc: { imageCount: images.length } },
          { session }
        );
      });

      logger.info("Multiple images created with GridFS", {
        count: images.length,
        customerId,
        companyId,
      });

      // Return metadata without fileId
      return images.map(({ fileId, ...metadata }) => metadata as CustomerImageMetadata);
    } catch (error) {
      // Cleanup GridFS files if transaction failed
      for (const fileId of uploadedFileIds) {
        try {
          await this.deleteFromGridFS(companyId, fileId);
        } catch (cleanupError) {
          logger.error("Failed to cleanup GridFS file after transaction failure", cleanupError);
        }
      }
      logger.error("Failed to create multiple images with GridFS", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerImage | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: ObjectId.createFromHexString(id) } as any);
    } catch (error) {
      logger.error("Failed to find image by ID", error);
      throw error;
    }
  }

  async findMetadataById(companyId: string, id: string): Promise<CustomerImageMetadata | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne(
        { _id: ObjectId.createFromHexString(id) } as any,
        { projection: { fileId: 0 } }
      ) as CustomerImageMetadata | null;
    } catch (error) {
      logger.error("Failed to find image metadata by ID", error);
      throw error;
    }
  }

  async findByCustomerId(companyId: string, customerId: string): Promise<CustomerImageMetadata[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find({ customerId } as any, { projection: { fileId: 0 } })
        .sort({ uploadedAt: -1 })
        .toArray() as CustomerImageMetadata[];
    } catch (error) {
      logger.error("Failed to fetch images by customerId", error);
      throw error;
    }
  }

  async findByLabelIds(companyId: string, labelIds: string[]): Promise<CustomerImageMetadata[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find(
          { labels: { $in: labelIds } } as any,
          { projection: { fileId: 0 } }
        )
        .sort({ uploadedAt: -1 })
        .toArray() as CustomerImageMetadata[];
    } catch (error) {
      logger.error("Failed to fetch images by label IDs", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<Pick<CustomerImage, "title" | "description" | "labels">>
  ): Promise<CustomerImageMetadata | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        { _id: ObjectId.createFromHexString(id) } as any,
        { $set: updates },
        { returnDocument: "after", projection: { fileId: 0 } }
      );
      return result as CustomerImageMetadata | null;
    } catch (error) {
      logger.error("Failed to update image", error);
      throw error;
    }
  }

  /**
   * Delete image and GridFS file (transaction)
   */
  async deleteWithTransaction(
    companyId: string,
    customerId: string,
    imageId: string
  ): Promise<boolean> {
    const client = getClient();
    const session = client.startSession();

    try {
      // First get the image to find the fileId
      const image = await this.findById(companyId, imageId);
      if (!image) {
        throw new Error("Image not found");
      }

      let deleted = false;

      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        // Delete the image metadata
        const deleteResult = await imagesCollection.deleteOne(
          { _id: ObjectId.createFromHexString(imageId) } as any,
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error("Image not found");
        }

        // Decrement customer imageCount
        await customersCollection.updateOne(
          { _id: customerId } as any,
          { $inc: { imageCount: -1 } },
          { session }
        );

        deleted = true;
      });

      // Delete from GridFS after successful transaction
      if (deleted && image.fileId) {
        await this.deleteFromGridFS(companyId, image.fileId);
      }

      logger.info("Image deleted with GridFS", { imageId, customerId, companyId });
      return deleted;
    } catch (error) {
      logger.error("Failed to delete image with GridFS", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ _id: ObjectId.createFromHexString(id) } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check image existence", error);
      throw error;
    }
  }

  async deleteAllByCustomerId(companyId: string, customerId: string, session: ClientSession): Promise<number> {
    try {
      const collection = this.getCollection(companyId);

      // First get all images to find fileIds
      const images = await collection.find({ customerId } as any).toArray();

      // Delete image records
      const result = await collection.deleteMany({ customerId } as any, { session });

      // Delete GridFS files (outside transaction)
      for (const image of images) {
        if (image.fileId) {
          try {
            await this.deleteFromGridFS(companyId, image.fileId);
          } catch (error) {
            logger.error("Failed to delete GridFS file during customer cleanup", error);
          }
        }
      }

      return result.deletedCount;
    } catch (error) {
      logger.error("Failed to delete customer images", error);
      throw error;
    }
  }
}

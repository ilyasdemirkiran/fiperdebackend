import { Collection, Binary } from "mongodb";
import { getDatabaseForCompany, getClient } from "@/config/database";
import { CustomerImage, CustomerImageMetadata } from "@/types/customer/customer_image";
import { logger } from "@/utils/logger";

export class CustomerImageRepository {
  private getCollection(companyId: string): Collection<CustomerImage> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<CustomerImage>("customer_images");
  }

  private getCustomersCollection(companyId: string) {
    const db = getDatabaseForCompany(companyId);
    return db.collection("customers");
  }

  /**
   * Create image and increment Customer.imageCount (transaction)
   */
  async createWithTransaction(
    companyId: string,
    customerId: string,
    image: CustomerImage
  ): Promise<CustomerImageMetadata> {
    const client = getClient();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        // Insert image
        await imagesCollection.insertOne(image as any, { session });

        // Increment customer imageCount
        await customersCollection.updateOne(
          { id: customerId } as any,
          { $inc: { imageCount: 1 } },
          { session }
        );
      });

      logger.info("Image created with transaction", {
        imageId: image.id,
        customerId,
        companyId,
      });

      // Return metadata without binary data
      const { data, ...metadata } = image;
      return metadata as CustomerImageMetadata;
    } catch (error) {
      logger.error("Failed to create image with transaction", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create multiple images and increment Customer.imageCount (transaction)
   */
  async createManyWithTransaction(
    companyId: string,
    customerId: string,
    images: CustomerImage[]
  ): Promise<CustomerImageMetadata[]> {
    const client = getClient();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        // Insert all images
        await imagesCollection.insertMany(images as any[], { session });

        // Increment customer imageCount by number of images
        await customersCollection.updateOne(
          { id: customerId } as any,
          { $inc: { imageCount: images.length } },
          { session }
        );
      });

      logger.info("Multiple images created with transaction", {
        count: images.length,
        customerId,
        companyId,
      });

      // Return metadata without binary data
      return images.map(({ data, ...metadata }) => metadata as CustomerImageMetadata);
    } catch (error) {
      logger.error("Failed to create multiple images with transaction", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerImage | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ id } as any, { projection: { _id: 0 } });
    } catch (error) {
      logger.error("Failed to find image by ID", error);
      throw error;
    }
  }

  async findMetadataById(companyId: string, id: string): Promise<CustomerImageMetadata | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne(
        { id } as any,
        { projection: { _id: 0, data: 0 } }
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
        .find({ customerId } as any, { projection: { _id: 0, data: 0 } })
        .sort({ uploadedAt: -1 })
        .toArray() as CustomerImageMetadata[];
    } catch (error) {
      logger.error("Failed to fetch images by customerId", error);
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
        { id } as any,
        { $set: updates },
        { returnDocument: "after", projection: { _id: 0, data: 0 } }
      );
      return result as CustomerImageMetadata | null;
    } catch (error) {
      logger.error("Failed to update image", error);
      throw error;
    }
  }

  /**
   * Delete image and decrement Customer.imageCount (transaction)
   */
  async deleteWithTransaction(
    companyId: string,
    customerId: string,
    imageId: string
  ): Promise<boolean> {
    const client = getClient();
    const session = client.startSession();

    try {
      let deleted = false;

      await session.withTransaction(async () => {
        const imagesCollection = this.getCollection(companyId);
        const customersCollection = this.getCustomersCollection(companyId);

        // Delete the image
        const deleteResult = await imagesCollection.deleteOne(
          { id: imageId } as any,
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error("Image not found");
        }

        // Decrement customer imageCount
        await customersCollection.updateOne(
          { id: customerId } as any,
          { $inc: { imageCount: -1 } },
          { session }
        );

        deleted = true;
      });

      logger.info("Image deleted with transaction", { imageId, customerId, companyId });
      return deleted;
    } catch (error) {
      logger.error("Failed to delete image with transaction", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check image existence", error);
      throw error;
    }
  }
}

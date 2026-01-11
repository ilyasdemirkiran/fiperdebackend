import { Collection, ClientSession, ObjectId } from "mongodb";
import { getDatabaseForCompany, getClient } from "@/config/database";
import type { CustomerImageLabel } from "@/types/customer/image/customer_image_label";
import { logger } from "@/utils/logger";

export class CustomerImageLabelRepository {
  private getCollection(companyId: string): Collection<CustomerImageLabel> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<CustomerImageLabel>("labels");
  }

  private getCustomerImagesCollection(companyId: string) {
    const db = getDatabaseForCompany(companyId);
    return db.collection("customer_images");
  }

  async create(companyId: string, label: CustomerImageLabel): Promise<Omit<CustomerImageLabel, "_id">> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(label as any);
      logger.info("Label created", { labelId: new ObjectId(label._id), companyId: new ObjectId(companyId) });
      return label;
    } catch (error) {
      logger.error("Failed to create label", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerImageLabel | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: new ObjectId(id) } as any);
    } catch (error) {
      logger.error("Failed to find label by ID", error);
      throw error;
    }
  }

  async findAll(companyId: string): Promise<CustomerImageLabel[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.find({}).toArray();
    } catch (error) {
      logger.error("Failed to fetch labels", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<CustomerImageLabel>
  ): Promise<CustomerImageLabel | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: updates },
        { returnDocument: "after" }
      );

      if (result) {
        logger.info("Label updated", { labelId: id, companyId });
      }

      return result;
    } catch (error) {
      logger.error("Failed to update label", error);
      throw error;
    }
  }

  /**
   * Delete label and remove it from all CustomerImage.labels (transaction)
   */
  async deleteWithTransaction(companyId: string, labelId: string): Promise<boolean> {
    const client = getClient();
    const session = client.startSession();

    try {
      let deleted = false;

      await session.withTransaction(async () => {
        const labelsCollection = this.getCollection(companyId);
        const imagesCollection = this.getCustomerImagesCollection(companyId);

        // Delete the label
        const deleteResult = await labelsCollection.deleteOne(
          { _id: new ObjectId(labelId) } as any,
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error("Label not found");
        }

        // Remove labelId from all customer_images.labels arrays
        await imagesCollection.updateMany(
          { labels: new ObjectId(labelId) } as any,
          { $pull: { labels: new ObjectId(labelId) } } as any,
          { session }
        );

        deleted = true;
        logger.info("Label deleted with transaction", { labelId, companyId });
      });

      return deleted;
    } catch (error) {
      logger.error("Failed to delete label with transaction", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ _id: new ObjectId(id) } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check label existence", error);
      throw error;
    }
  }
}

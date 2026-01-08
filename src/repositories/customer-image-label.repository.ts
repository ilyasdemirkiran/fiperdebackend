import { Collection, ClientSession } from "mongodb";
import { getDatabaseForCompany, getClient } from "@/config/database";
import type { CustomerImageLabel } from "@/types/customer/customer_image_label";
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

  async create(companyId: string, label: CustomerImageLabel): Promise<CustomerImageLabel> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(label as any);
      logger.info("Label created", { labelId: label._id, companyId });
      return label;
    } catch (error) {
      logger.error("Failed to create label", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerImageLabel | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ _id: id } as any, { projection: { _id: 0 } });
    } catch (error) {
      logger.error("Failed to find label by ID", error);
      throw error;
    }
  }

  async findAll(companyId: string): Promise<CustomerImageLabel[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.find({}, { projection: { _id: 0 } }).toArray();
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
        { _id: id } as any,
        { $set: updates },
        { returnDocument: "after", projection: { _id: 0 } }
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

  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: id } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Label deleted", { labelId: id, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete label", error);
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
          { _id: labelId } as any,
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error("Label not found");
        }

        // Remove labelId from all customer_images.labels arrays
        await imagesCollection.updateMany(
          { labels: labelId },
          { $pull: { labels: labelId } } as any,
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
      const count = await collection.countDocuments({ _id: id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check label existence", error);
      throw error;
    }
  }
}

import { CustomerImageLabelRepository } from "@/repositories/customer-image-label.repository";
import type { CustomerImageLabel } from "@/types/customer/customer_image_label";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";

export class CustomerImageLabelService {
  private repository: CustomerImageLabelRepository;

  constructor() {
    this.repository = new CustomerImageLabelRepository();
  }

  async createLabel(companyId: string, name: string): Promise<CustomerImageLabel> {
    // Omit _id - MongoDB will auto-generate ObjectId
    const label: Omit<CustomerImageLabel, "_id"> = {
      name,
    };

    return await this.repository.create(companyId, label);
  }

  async getLabel(companyId: string, id: string): Promise<CustomerImageLabel> {
    const label = await this.repository.findById(companyId, id);

    if (!label) {
      throw new AppError(404, "Label not found", "LABEL_NOT_FOUND");
    }

    return label;
  }

  async listLabels(companyId: string): Promise<CustomerImageLabel[]> {
    return await this.repository.findAll(companyId);
  }

  async updateLabel(
    companyId: string,
    id: string,
    name: string
  ): Promise<CustomerImageLabel> {
    const exists = await this.repository.exists(companyId, id);
    if (!exists) {
      throw new AppError(404, "Label not found", "LABEL_NOT_FOUND");
    }

    const updated = await this.repository.update(companyId, id, { name });

    if (!updated) {
      throw new AppError(500, "Failed to update label", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteLabel(companyId: string, id: string): Promise<void> {
    const exists = await this.repository.exists(companyId, id);
    if (!exists) {
      throw new AppError(404, "Label not found", "LABEL_NOT_FOUND");
    }

    // Use transaction to delete label and remove from all images
    const deleted = await this.repository.deleteWithTransaction(companyId, id);

    if (!deleted) {
      throw new AppError(500, "Failed to delete label", "DELETE_FAILED");
    }

    logger.info("Label deleted successfully", { id, companyId });
  }
}

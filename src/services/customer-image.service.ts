import { CustomerImageRepository } from "@/repositories/customer-image.repository";
import { CustomerImage, CustomerImageMetadata } from "@/types/customer/customer_image";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { Binary } from "mongodb";

export interface UploadImageInput {
  title: string;
  description?: string;
  filename: string;
  mimeType: string;
  data: Buffer; // Raw binary data from upload
  labels?: string[];
}

export class CustomerImageService {
  private repository: CustomerImageRepository;

  constructor() {
    this.repository = new CustomerImageRepository();
  }

  async uploadImage(
    companyId: string,
    customerId: string,
    uploaderId: string,
    input: UploadImageInput
  ): Promise<CustomerImageMetadata> {
    const id = crypto.randomUUID();

    const image: CustomerImage = {
      id,
      customerId,
      title: input.title,
      description: input.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.data.length,
      data: new Binary(input.data),
      labels: input.labels || [],
    };

    return await this.repository.createWithTransaction(companyId, customerId, image);
  }

  async uploadMultipleImages(
    companyId: string,
    customerId: string,
    uploaderId: string,
    inputs: UploadImageInput[]
  ): Promise<CustomerImageMetadata[]> {
    const images: CustomerImage[] = inputs.map((input) => ({
      id: crypto.randomUUID(),
      customerId,
      title: input.title,
      description: input.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.data.length,
      data: new Binary(input.data),
      labels: input.labels || [],
    }));

    return await this.repository.createManyWithTransaction(companyId, customerId, images);
  }

  async getImageMetadata(companyId: string, imageId: string): Promise<CustomerImageMetadata> {
    const image = await this.repository.findMetadataById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    return image;
  }

  async getImageData(companyId: string, imageId: string): Promise<CustomerImage> {
    const image = await this.repository.findById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    return image;
  }

  async listImagesByCustomer(
    companyId: string,
    customerId: string
  ): Promise<CustomerImageMetadata[]> {
    return await this.repository.findByCustomerId(companyId, customerId);
  }

  async updateImage(
    companyId: string,
    imageId: string,
    updates: Partial<Pick<CustomerImage, "title" | "description" | "labels">>
  ): Promise<CustomerImageMetadata> {
    const exists = await this.repository.exists(companyId, imageId);
    if (!exists) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    const updated = await this.repository.update(companyId, imageId, updates);

    if (!updated) {
      throw new AppError(500, "Failed to update image", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteImage(
    companyId: string,
    customerId: string,
    imageId: string
  ): Promise<void> {
    const image = await this.repository.findMetadataById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    if (image.customerId !== customerId) {
      throw new AppError(403, "Image does not belong to this customer", "FORBIDDEN");
    }

    const deleted = await this.repository.deleteWithTransaction(
      companyId,
      customerId,
      imageId
    );

    if (!deleted) {
      throw new AppError(500, "Failed to delete image", "DELETE_FAILED");
    }

    logger.info("Image deleted successfully", { imageId, customerId, companyId });
  }
}

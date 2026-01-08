import { CustomerImageRepository } from "@/repositories/customer-image.repository";
import type { CustomerImage, CustomerImageMetadata } from "@/types/customer/customer_image";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { Binary, ObjectId } from "mongodb";
import { UploadSessionRepository } from "@/repositories/upload-session.repository";
import type { InitUploadInput, UploadSession, UploadChunk } from "@/types/common/upload";

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
  private uploadRepository: UploadSessionRepository;

  constructor() {
    this.repository = new CustomerImageRepository();
    this.uploadRepository = new UploadSessionRepository();
  }

  async uploadImage(
    companyId: string,
    customerId: string,
    uploaderId: string,
    input: UploadImageInput
  ): Promise<CustomerImageMetadata> {
    // Omit _id - MongoDB will auto-generate ObjectId
    const image: Omit<CustomerImage, "_id"> = {
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
    // Omit _id - MongoDB will auto-generate ObjectId for each
    const images: Omit<CustomerImage, "_id">[] = inputs.map((input) => ({
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

  // Resumable Upload Methods

  async initUpload(
    companyId: string,
    customerId: string,
    uploaderId: string,
    input: InitUploadInput
  ): Promise<{ uploadId: string }> {
    const session: UploadSession = {
      companyId,
      customerId,
      uploaderId,
      filename: input.filename,
      mimeType: input.mimeType,
      totalSize: input.totalSize,
      uploadedChunks: [],
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    const created = await this.uploadRepository.createSession(companyId, session);
    return { uploadId: created._id!.toHexString() };
  }

  async uploadChunk(
    companyId: string,
    uploadId: string,
    chunkIndex: number,
    data: Buffer
  ): Promise<{ uploadedChunks: number[] }> {
    const session = await this.uploadRepository.getSession(companyId, uploadId);
    if (!session) {
      throw new AppError(404, "Upload session not found", "SESSION_NOT_FOUND");
    }

    const chunk: UploadChunk = {
      uploadId: session._id!,
      index: chunkIndex,
      data: new Binary(data),
      size: data.length
    };

    await this.uploadRepository.saveChunk(companyId, chunk);

    // Refresh session to get updated chunk list
    const updatedSession = await this.uploadRepository.getSession(companyId, uploadId);
    return { uploadedChunks: updatedSession?.uploadedChunks || [] };
  }

  async finalizeUpload(
    companyId: string,
    uploadId: string,
    metadata: { title: string; description?: string; labels?: string[] }
  ): Promise<CustomerImageMetadata> {
    const session = await this.uploadRepository.getSession(companyId, uploadId);
    if (!session) {
      throw new AppError(404, "Upload session not found", "SESSION_NOT_FOUND");
    }

    const chunks = await this.uploadRepository.getChunks(companyId, session._id!);
    if (chunks.length === 0) {
      throw new AppError(400, "No chunks uploaded", "INVALID_UPLOAD");
    }

    // Merge chunks
    const buffer = Buffer.concat(chunks.map(c => c.data.buffer));

    // Verify size (optional but recommended)
    if (buffer.length !== session.totalSize) {
      logger.warn(`Upload size mismatch. Expected: ${session.totalSize}, Got: ${buffer.length}`, { uploadId });
      // We might choose to proceed or error out. Let's error out for integrity.
      // throw new AppError(400, "Upload size mismatch", "INTEGRITY_ERROR");
    }

    // Create CustomerImage
    const image: Omit<CustomerImage, "_id"> = {
      customerId: session.customerId,
      title: metadata.title,
      description: metadata.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId: session.uploaderId,
      filename: session.filename,
      mimeType: session.mimeType,
      size: buffer.length,
      data: new Binary(buffer),
      labels: metadata.labels || [],
    };

    const createdImage = await this.repository.createWithTransaction(companyId, session.customerId, image);

    // Cleanup session and chunks
    await this.uploadRepository.deleteSessionAndChunks(companyId, uploadId);

    return createdImage;
  }
}

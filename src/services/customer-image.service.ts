import { CustomerImageRepository } from "@/repositories/customer-image.repository";
import type { CustomerImage, CustomerImageMetadata } from "@/types/customer/image/customer_image";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { ObjectId } from "mongodb";
import { UploadSessionRepository } from "@/repositories/upload-session.repository";
import type { InitUploadInput, UploadSession, UploadChunk } from "@/types/common/upload";
import type { Readable } from "stream";

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
    return await this.repository.createWithTransaction(companyId, customerId, {
      title: input.title,
      description: input.description,
      filename: input.filename,
      mimeType: input.mimeType,
      data: input.data,
      uploaderId,
      labels: input.labels,
      uploadedAt: Timestamp.now(),
    });
  }

  async uploadMultipleImages(
    companyId: string,
    customerId: string,
    uploaderId: string,
    inputs: UploadImageInput[]
  ): Promise<CustomerImageMetadata[]> {
    const imagesData = inputs.map((input) => ({
      title: input.title,
      description: input.description,
      filename: input.filename,
      mimeType: input.mimeType,
      data: input.data,
      uploaderId,
      labels: input.labels,
      uploadedAt: Timestamp.now(),
    }));

    return await this.repository.createManyWithTransaction(companyId, customerId, imagesData);
  }

  async getImageMetadata(companyId: string, imageId: string): Promise<CustomerImageMetadata> {
    const image = await this.repository.findMetadataById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    return image;
  }

  /**
   * Get image data as buffer (downloads from GridFS)
   */
  async getImageData(companyId: string, imageId: string): Promise<{ buffer: Buffer; metadata: CustomerImage }> {
    const image = await this.repository.findById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    const buffer = await this.repository.downloadFromGridFS(companyId, image.fileId);

    return { buffer, metadata: image };
  }

  /**
   * Get image download stream (for streaming response)
   */
  getImageStream(companyId: string, fileId: ObjectId): Readable {
    return this.repository.getDownloadStream(companyId, fileId);
  }

  /**
   * Get image with stream (finds image and returns stream)
   */
  async getImageWithStream(companyId: string, imageId: string): Promise<{ stream: Readable; metadata: CustomerImage }> {
    const image = await this.repository.findById(companyId, imageId);

    if (!image) {
      throw new AppError(404, "Image not found", "IMAGE_NOT_FOUND");
    }

    const stream = this.repository.getDownloadStream(companyId, image.fileId);

    return { stream, metadata: image };
  }

  async listImagesByCustomer(
    companyId: string,
    customerId: string
  ): Promise<CustomerImageMetadata[]> {
    return await this.repository.findByCustomerId(companyId, customerId);
  }

  async getImagesByLabels(
    companyId: string,
    labelIds: string[]
  ): Promise<CustomerImageMetadata[]> {
    if (!labelIds || labelIds.length === 0) {
      return [];
    }
    return await this.repository.findByLabelIds(companyId, labelIds);
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
      data: new (await import("mongodb")).Binary(data),
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
    }

    // Create image with GridFS
    const createdImage = await this.repository.createWithTransaction(companyId, session.customerId, {
      title: metadata.title,
      description: metadata.description,
      filename: session.filename,
      mimeType: session.mimeType,
      data: buffer,
      uploaderId: session.uploaderId,
      labels: metadata.labels,
      uploadedAt: Timestamp.now(),
    });

    // Cleanup session and chunks
    await this.uploadRepository.deleteSessionAndChunks(companyId, uploadId);

    return createdImage;
  }
}

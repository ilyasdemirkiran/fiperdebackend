import { VendorAttachmentRepository } from "@/repositories/vendor-attachment.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import {
  VendorAttachment,
  VendorAttachmentMetadata,
  ALLOWED_ATTACHMENT_MIME_TYPE,
} from "@/types/vendor/vendor_attachment";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { UserRole } from "@/types/user/fi_user";
import { Binary } from "mongodb";

export interface UploadAttachmentInput {
  title: string;
  description?: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export class VendorAttachmentService {
  private repository: VendorAttachmentRepository;
  private vendorRepository: VendorRepository;

  constructor() {
    this.repository = new VendorAttachmentRepository();
    this.vendorRepository = new VendorRepository();
  }

  /**
   * Assert that user is sudo
   */
  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can manage vendor attachments", "FORBIDDEN");
    }
  }

  /**
   * Validate that the file is a PDF
   */
  private validatePdf(mimeType: string, filename: string): void {
    if (mimeType !== ALLOWED_ATTACHMENT_MIME_TYPE) {
      throw new AppError(400, "Only PDF files are allowed", "INVALID_FILE_TYPE");
    }

    if (!filename.toLowerCase().endsWith(".pdf")) {
      throw new AppError(400, "File must have .pdf extension", "INVALID_FILE_EXTENSION");
    }
  }

  /**
   * Upload a new attachment for a vendor (sudo only, PDF only)
   */
  async uploadAttachment(
    vendorId: string,
    uploaderId: string,
    role: UserRole,
    input: UploadAttachmentInput
  ): Promise<VendorAttachmentMetadata> {
    this.assertSudo(role);
    this.validatePdf(input.mimeType, input.filename);

    // Check if vendor exists
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    // Omit _id - MongoDB will auto-generate ObjectId
    const attachment: Omit<VendorAttachment, "_id"> = {
      vendorId,
      title: input.title,
      description: input.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      filename: input.filename,
      mimeType: "application/pdf", // Enforce PDF
      size: input.size,
      data: new Binary(input.data),
    };

    const created = await this.repository.create(attachment);

    logger.info("Vendor attachment uploaded", {
      attachmentId: created._id?.toString(),
      vendorId,
      uploaderId,
      filename: input.filename,
    });

    // Return metadata without binary data
    const { data, ...metadata } = created;
    return metadata as VendorAttachmentMetadata;
  }

  /**
   * Get attachment by ID (returns full attachment with binary data)
   */
  async getAttachment(attachmentId: string): Promise<VendorAttachment> {
    const attachment = await this.repository.findById(attachmentId);

    if (!attachment) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    return attachment;
  }

  /**
   * Get attachment metadata by ID (without binary data)
   */
  async getAttachmentMetadata(attachmentId: string): Promise<VendorAttachmentMetadata> {
    const attachment = await this.repository.findById(attachmentId);

    if (!attachment) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    const { data, ...metadata } = attachment;
    return metadata as VendorAttachmentMetadata;
  }

  /**
   * List all attachments for a vendor (metadata only)
   */
  async listAttachmentsByVendor(vendorId: string): Promise<VendorAttachmentMetadata[]> {
    // Check if vendor exists
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const attachments = await this.repository.findByVendorId(vendorId);

    // Return metadata without binary data
    return attachments.map(({ data, ...metadata }) => metadata as VendorAttachmentMetadata);
  }

  /**
   * Update attachment metadata (sudo only)
   */
  async updateAttachment(
    attachmentId: string,
    role: UserRole,
    updates: Partial<Pick<VendorAttachment, "title" | "description">>
  ): Promise<VendorAttachmentMetadata> {
    this.assertSudo(role);

    const exists = await this.repository.exists(attachmentId);
    if (!exists) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    const updated = await this.repository.update(attachmentId, updates);

    if (!updated) {
      throw new AppError(500, "Failed to update attachment", "UPDATE_FAILED");
    }

    logger.info("Vendor attachment updated", { attachmentId });

    const { data, ...metadata } = updated;
    return metadata as VendorAttachmentMetadata;
  }

  /**
   * Delete an attachment (sudo only)
   */
  async deleteAttachment(attachmentId: string, role: UserRole): Promise<void> {
    this.assertSudo(role);

    const exists = await this.repository.exists(attachmentId);
    if (!exists) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    const deleted = await this.repository.delete(attachmentId);

    if (!deleted) {
      throw new AppError(500, "Failed to delete attachment", "DELETE_FAILED");
    }

    logger.info("Vendor attachment deleted", { attachmentId });
  }

  /**
   * Delete all attachments for a vendor (sudo only)
   * Usually called when deleting a vendor
   */
  async deleteAllAttachmentsForVendor(vendorId: string, role: UserRole): Promise<number> {
    this.assertSudo(role);

    const count = await this.repository.deleteByVendorId(vendorId);

    logger.info("All attachments deleted for vendor", { vendorId, count });

    return count;
  }
}

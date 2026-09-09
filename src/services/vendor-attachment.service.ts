import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { ALLOWED_DOCUMENT_MIME_TYPES, type VendorAttachment, type VendorAttachmentMetadata } from "@/types/vendor/vendor_attachment";
import { type VendorDocument } from "@/types/vendor/vendor_document";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { Binary, ObjectId } from "mongodb";

export interface UploadAttachmentInput {
  title: string;
  description?: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
];

export class VendorAttachmentService {
  private repository: VendorDocumentRepository;
  private vendorRepository: VendorRepository;

  constructor() {
    this.repository = new VendorDocumentRepository();
    this.vendorRepository = new VendorRepository();
  }

  /**
   * Validate that the file is an allowed type (PDF, Excel, Word, Image)
   */
  private validateFile(mimeType: string, filename: string): void {
    const isMimeAllowed = ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType as any);
    const lowerFilename = filename.toLowerCase();
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext));

    if (!isMimeAllowed && !hasAllowedExtension) {
      throw new AppError(
        400,
        "Only PDF, Excel (.xlsx, .xls), Word (.docx, .doc), and Image (.jpg, .png, .gif, .webp) files are allowed",
        "INVALID_FILE_TYPE"
      );
    }
  }

  /**
   * Upload a new attachment for a vendor in company database
   */
  async uploadAttachment(
    companyId: string,
    vendorId: string,
    uploaderId: string,
    uploaderName: string,
    input: UploadAttachmentInput
  ): Promise<VendorAttachmentMetadata> {
    this.validateFile(input.mimeType, input.filename);

    // Check if vendor exists in company DB
    const vendor = await this.vendorRepository.findById(vendorId, companyId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const document: Omit<VendorDocument, "_id"> = {
      vendorId: new ObjectId(vendorId),
      title: input.title,
      description: input.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      uploaderName,
      filename: input.filename,
      mimeType: input.mimeType as any,
      size: input.size,
      data: new Binary(input.data),
    };

    const created = await this.repository.create(document, vendorId, companyId);

    logger.info("Vendor attachment created", {
      documentId: created._id?.toString(),
      vendorId,
      uploaderId,
      filename: input.filename,
      companyId,
    });

    const { data, ...metadata } = created;
    return metadata as unknown as VendorAttachmentMetadata;
  }

  /**
   * Get attachment by ID (with binary data)
   */
  async getAttachment(attachmentId: string, companyId?: string): Promise<VendorAttachment> {
    const document = await this.repository.findById(attachmentId, companyId);

    if (!document) {
      throw new AppError(404, `Attachment not found: ${attachmentId}`, "ATTACHMENT_NOT_FOUND");
    }

    return document as unknown as VendorAttachment;
  }

  /**
   * Get attachment metadata by ID
   */
  async getAttachmentMetadata(attachmentId: string, companyId?: string): Promise<VendorAttachmentMetadata> {
    const document = await this.repository.findById(attachmentId, companyId);

    if (!document) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    const { data, ...metadata } = document;
    return metadata as unknown as VendorAttachmentMetadata;
  }

  /**
   * List all attachments for a vendor in company database
   */
  async listAttachmentsByVendor(vendorId: string, companyId?: string): Promise<VendorAttachmentMetadata[]> {
    const vendor = await this.vendorRepository.findById(vendorId, companyId);
    if (!vendor) {
      throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    }

    const documents = await this.repository.findAllByVendorId(vendorId, companyId);
    return documents.map((doc) => doc as unknown as VendorAttachmentMetadata);
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string, companyId?: string): Promise<void> {
    const deleted = await this.repository.delete(attachmentId, companyId);

    if (!deleted) {
      throw new AppError(404, "Attachment/Document not found", "ATTACHMENT_NOT_FOUND");
    }

    logger.info("Vendor attachment deleted", { attachmentId, companyId });
  }

  /**
   * Delete all attachments for a vendor
   */
  async deleteAllAttachmentsForVendor(vendorId: string, companyId?: string): Promise<number> {
    return await this.repository.deleteByVendorId(vendorId, companyId);
  }
}

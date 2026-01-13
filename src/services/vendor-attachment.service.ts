import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import {
  type VendorAttachment,
  type VendorAttachmentMetadata,
  ALLOWED_ATTACHMENT_MIME_TYPE,
} from "@/types/vendor/vendor_attachment";
import { type VendorDocument, type VendorDocumentMetadata } from "@/types/vendor/vendor_document";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import type { UserRole } from "@/types/user/fi_user";
import { Binary, ObjectId } from "mongodb";

export interface UploadAttachmentInput {
  title: string;
  description?: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export class VendorAttachmentService {
  private repository: VendorDocumentRepository;
  private vendorRepository: VendorRepository;

  constructor() {
    this.repository = new VendorDocumentRepository();
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
   * Note: Stores in vendor_documents collection
   */
  async uploadAttachment(
    vendorId: string,
    uploaderId: string,
    uploaderName: string,
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

    const document: Omit<VendorDocument, "_id"> = {
      vendorId: new ObjectId(vendorId),
      title: input.title,
      description: input.description || "",
      uploadedAt: Timestamp.now(),
      uploaderId,
      uploaderName,
      filename: input.filename,
      mimeType: "application/pdf" as any, // Enforced by validatePdf and type
      size: input.size,
      data: new Binary(input.data),
    };

    const created = await this.repository.create(document, vendorId);

    logger.info("Vendor attachment created (as document)", {
      documentId: created._id?.toString(),
      vendorId,
      uploaderId,
      filename: input.filename,
    });

    // Return metadata without binary data, cast to AttachmentMetadata format
    const { data, ...metadata } = created;
    return metadata as unknown as VendorAttachmentMetadata;
  }

  /**
   * Get attachment by ID (returns full attachment with binary data)
   */
  async getAttachment(attachmentId: string): Promise<VendorAttachment> {
    const document = await this.repository.findById(attachmentId);

    if (!document) {
      throw new AppError(404, `Attachment not found: ${attachmentId}`, "ATTACHMENT_NOT_FOUND");
    }

    // Cast to VendorAttachment - structures are compatible for shared fields
    return document as unknown as VendorAttachment;
  }

  /**
   * Get attachment metadata by ID (without binary data)
   */
  async getAttachmentMetadata(attachmentId: string): Promise<VendorAttachmentMetadata> {
    const document = await this.repository.findById(attachmentId);

    if (!document) {
      throw new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    }

    const { data, ...metadata } = document;
    return metadata as unknown as VendorAttachmentMetadata;
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

    // Use findAllByVendorId from document repo
    const documents = await this.repository.findAllByVendorId(vendorId);

    // Filter only PDFs if we want to strictly emulate "Attachments" behavior,
    // or return all if unification means "all documents".
    // For now, let's filter for PDFs to maintain expected behavior if "Attachments" meant specifically PDFs
    // But since the request is unification, showing all might be better.
    // Let's filter by PDF to keep consistency with the 'Attachment' service name constraints
    const pdfs = documents.filter(doc => doc.mimeType === "application/pdf");

    return pdfs.map(doc => doc as unknown as VendorAttachmentMetadata);
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

    throw new AppError(501, "Update not implemented for documents yet", "NOT_IMPLEMENTED");
  }

  /**
   * Delete an attachment (sudo only)
   */
  async deleteAttachment(attachmentId: string, role: UserRole): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.repository.delete(attachmentId);

    if (!deleted) {
      throw new AppError(404, "Attachment/Document not found", "ATTACHMENT_NOT_FOUND");
    }

    logger.info("Vendor attachment/document deleted", { attachmentId });
  }

  /**
   * Delete all attachments for a vendor (sudo only)
   * Usually called when deleting a vendor
   */
  async deleteAllAttachmentsForVendor(vendorId: string, role: UserRole): Promise<number> {
    this.assertSudo(role);
    // Be careful! This deletes ALL documents, not just PDFs.
    // If VendorService also calls this, we might do double delete or it's fine.
    // If we Unify, VendorService likely calls documentRepository.deleteByVendorId directly.
    return await this.repository.deleteByVendorId(vendorId);
  }
}

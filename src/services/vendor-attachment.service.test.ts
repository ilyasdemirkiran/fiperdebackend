import { describe, expect, it, beforeEach, mock, spyOn } from "bun:test";
import { VendorAttachmentService } from "./vendor-attachment.service";
import { VendorDocumentRepository } from "@/repositories/vendor-document.repository";
import { VendorRepository } from "@/repositories/vendor.repository";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { ObjectId, Binary } from "mongodb";

describe("VendorAttachmentService", () => {
  let service: VendorAttachmentService;
  let mockDocRepo: Partial<VendorDocumentRepository>;
  let mockVendorRepo: Partial<VendorRepository>;

  const companyId = "company-123";
  const vendorId = new ObjectId().toString();
  const attachmentId = new ObjectId().toString();

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});

    mockDocRepo = {
      create: mock(),
      findById: mock(),
      findAllByVendorId: mock(),
      delete: mock(),
      deleteByVendorId: mock(),
    };

    mockVendorRepo = {
      findById: mock(),
    };

    service = new VendorAttachmentService(
      mockDocRepo as VendorDocumentRepository,
      mockVendorRepo as VendorRepository
    );
  });

  describe("uploadAttachment", () => {
    it("should reject disallowed file extension and mime type", async () => {
      expect(
        service.uploadAttachment(companyId, vendorId, "user-1", "User One", {
          filename: "malicious.exe",
          mimeType: "application/x-msdownload",
          title: "Bad File",
          size: 1024,
          data: Buffer.from("bad content"),
        })
      ).rejects.toThrow(AppError);
    });

    it("should allow file if extension is allowed even if mime type is generic", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(vendorId),
        name: "Test Vendor",
      });

      const fakeDoc = {
        _id: new ObjectId(),
        title: "Test PDF",
        filename: "test.pdf",
        mimeType: "application/octet-stream",
        size: 500,
        data: new Binary(Buffer.from("dummy")),
      };
      (mockDocRepo.create as any).mockResolvedValue(fakeDoc);

      const result = await service.uploadAttachment(companyId, vendorId, "user-1", "User One", {
        filename: "test.pdf",
        mimeType: "application/octet-stream",
        title: "Test PDF",
        size: 500,
        data: Buffer.from("dummy"),
      });

      expect(result.filename).toBe("test.pdf");
      expect(mockDocRepo.create).toHaveBeenCalled();
    });

    it("should throw 404 if vendor does not exist", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(
        service.uploadAttachment(companyId, vendorId, "user-1", "User One", {
          filename: "doc.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          title: "Contract",
          size: 2048,
          data: Buffer.from("data"),
        })
      ).rejects.toThrow(new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND"));
    });

    it("should create attachment and strip raw binary data from returned metadata", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(vendorId),
        name: "Test Vendor",
      });

      const fakeDoc = {
        _id: new ObjectId(),
        title: "Price List",
        filename: "prices.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1024,
        data: new Binary(Buffer.from("excel data")),
      };
      (mockDocRepo.create as any).mockResolvedValue(fakeDoc);

      const result = await service.uploadAttachment(companyId, vendorId, "user-1", "User One", {
        filename: "prices.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        title: "Price List",
        size: 1024,
        data: Buffer.from("excel data"),
      });

      expect(result.title).toBe("Price List");
      expect((result as any).data).toBeUndefined();
    });
  });

  describe("getAttachment", () => {
    it("should return attachment with binary data if found", async () => {
      const fakeDoc = {
        _id: new ObjectId(attachmentId),
        filename: "image.png",
        data: new Binary(Buffer.from("img")),
      };
      (mockDocRepo.findById as any).mockResolvedValue(fakeDoc);

      const result = await service.getAttachment(attachmentId, companyId);
      expect(result._id?.toString()).toBe(attachmentId);
      expect(result.data).toBeDefined();
    });

    it("should throw 404 if attachment is not found", async () => {
      (mockDocRepo.findById as any).mockResolvedValue(null);

      expect(service.getAttachment(attachmentId, companyId)).rejects.toThrow(
        new AppError(404, `Attachment not found: ${attachmentId}`, "ATTACHMENT_NOT_FOUND")
      );
    });
  });

  describe("getAttachmentMetadata", () => {
    it("should return metadata without binary data", async () => {
      const fakeDoc = {
        _id: new ObjectId(attachmentId),
        filename: "image.png",
        data: new Binary(Buffer.from("img")),
      };
      (mockDocRepo.findById as any).mockResolvedValue(fakeDoc);

      const result = await service.getAttachmentMetadata(attachmentId, companyId);
      expect(result._id?.toString()).toBe(attachmentId);
      expect((result as any).data).toBeUndefined();
    });

    it("should throw 404 if attachment not found", async () => {
      (mockDocRepo.findById as any).mockResolvedValue(null);

      expect(service.getAttachmentMetadata(attachmentId, companyId)).rejects.toThrow(
        new AppError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND")
      );
    });
  });

  describe("listAttachmentsByVendor", () => {
    it("should throw 404 if vendor does not exist", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue(null);

      expect(service.listAttachmentsByVendor(vendorId, companyId)).rejects.toThrow(
        new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND")
      );
    });

    it("should list all attachments for vendor", async () => {
      (mockVendorRepo.findById as any).mockResolvedValue({ _id: new ObjectId(vendorId) });
      (mockDocRepo.findAllByVendorId as any).mockResolvedValue([
        { _id: new ObjectId(), filename: "file1.pdf" },
        { _id: new ObjectId(), filename: "file2.pdf" },
      ]);

      const list = await service.listAttachmentsByVendor(vendorId, companyId);
      expect(list).toHaveLength(2);
      expect(list[0]!.filename).toBe("file1.pdf");
    });
  });

  describe("deleteAttachment", () => {
    it("should delete attachment successfully", async () => {
      (mockDocRepo.delete as any).mockResolvedValue(true);

      await expect(service.deleteAttachment(attachmentId, companyId)).resolves.toBeUndefined();
      expect(mockDocRepo.delete).toHaveBeenCalledWith(attachmentId, companyId);
    });

    it("should throw 404 if delete returns false", async () => {
      (mockDocRepo.delete as any).mockResolvedValue(false);

      expect(service.deleteAttachment(attachmentId, companyId)).rejects.toThrow(
        new AppError(404, "Attachment/Document not found", "ATTACHMENT_NOT_FOUND")
      );
    });
  });

  describe("deleteAllAttachmentsForVendor", () => {
    it("should return count of deleted attachments", async () => {
      (mockDocRepo.deleteByVendorId as any).mockResolvedValue(3);

      const count = await service.deleteAllAttachmentsForVendor(vendorId, companyId);
      expect(count).toBe(3);
      expect(mockDocRepo.deleteByVendorId).toHaveBeenCalledWith(vendorId, companyId);
    });
  });
});

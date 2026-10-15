import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CustomerImageService } from "./customer-image.service";
import { AppError } from "@/middleware/error-handler";
import type { CustomerImageRepository } from "@/repositories/customer-image.repository";
import type { UploadSessionRepository } from "@/repositories/upload-session.repository";
import type { CustomerImageMetadata } from "@/types/customer/image/customer_image";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("CustomerImageService Unit Tests", () => {
  let imageService: CustomerImageService;
  let mockImageRepo: Partial<CustomerImageRepository>;
  let mockUploadRepo: Partial<UploadSessionRepository>;

  const companyId = "comp-1";
  const customerId = "cust-1";
  const imageId = "img-1";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockImageRepo = {
      createWithTransaction: mock(),
      createManyWithTransaction: mock(),
      findMetadataById: mock(),
      findByCustomerId: mock(),
      findById: mock(),
      downloadFromGridFS: mock(),
      update: mock(),
      deleteWithTransaction: mock(),
      exists: mock(),
    };

    mockUploadRepo = {
      createSession: mock(),
      getSession: mock(),
      saveChunk: mock(),
      deleteSessionAndChunks: mock(),
    };

    imageService = new CustomerImageService(
      mockImageRepo as CustomerImageRepository,
      mockUploadRepo as UploadSessionRepository
    );
  });

  describe("uploadImage & uploadMultipleImages", () => {
    it("should upload single image and return metadata", async () => {
      const mockMeta: CustomerImageMetadata = {
        _id: new ObjectId(),
        title: "Perde Fotoğrafı",
        description: "",
        filename: "perde.jpg",
        mimeType: "image/jpeg",
        size: 1024,
        uploaderId: "u1",
        labels: [],
        uploadedAt: Timestamp.now(),
      };
      (mockImageRepo.createWithTransaction as any).mockResolvedValue(mockMeta);

      const result = await imageService.uploadImage(companyId, customerId, "u1", {
        title: "Perde Fotoğrafı",
        filename: "perde.jpg",
        mimeType: "image/jpeg",
        data: Buffer.from("image-bytes"),
      });

      expect(result.title).toBe("Perde Fotoğrafı");
      expect(mockImageRepo.createWithTransaction).toHaveBeenCalled();
    });

    it("should upload multiple images in bulk", async () => {
      (mockImageRepo.createManyWithTransaction as any).mockResolvedValue([
        { _id: new ObjectId(), title: "Foto 1" },
        { _id: new ObjectId(), title: "Foto 2" },
      ]);

      const result = await imageService.uploadMultipleImages(companyId, customerId, "u1", [
        { title: "Foto 1", filename: "1.jpg", mimeType: "image/jpeg", data: Buffer.from("1") },
        { title: "Foto 2", filename: "2.jpg", mimeType: "image/jpeg", data: Buffer.from("2") },
      ]);

      expect(result.length).toBe(2);
      expect(mockImageRepo.createManyWithTransaction).toHaveBeenCalled();
    });
  });

  describe("getImageMetadata & getImageData", () => {
    it("should throw AppError(404) if metadata not found", async () => {
      (mockImageRepo.findMetadataById as any).mockResolvedValue(null);

      expect(imageService.getImageMetadata(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Image not found", "IMAGE_NOT_FOUND")
      );
    });

    it("should throw AppError(404) if image record not found for getImageData", async () => {
      (mockImageRepo.findById as any).mockResolvedValue(null);

      expect(imageService.getImageData(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Image not found", "IMAGE_NOT_FOUND")
      );
    });

    it("should return buffer and metadata when found", async () => {
      const mockBuffer = Buffer.from("binary-img");
      const mockImage = {
        _id: new ObjectId(),
        fileId: new ObjectId(),
        filename: "logo.png",
        mimeType: "image/png",
      };
      (mockImageRepo.findById as any).mockResolvedValue(mockImage);
      (mockImageRepo.downloadFromGridFS as any).mockResolvedValue(mockBuffer);

      const result = await imageService.getImageData(companyId, imageId);
      expect(result.buffer).toEqual(mockBuffer);
      expect(result.metadata.filename).toBe("logo.png");
    });
  });

  describe("deleteImage", () => {
    it("should throw AppError(404) if image does not exist", async () => {
      (mockImageRepo.findMetadataById as any).mockResolvedValue(null);

      expect(imageService.deleteImage(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Image not found", "IMAGE_NOT_FOUND")
      );
    });

    it("should delete image with transaction successfully", async () => {
      const mockMeta = { _id: new ObjectId(), fileId: new ObjectId(), customerId: new ObjectId() };
      (mockImageRepo.findMetadataById as any).mockResolvedValue(mockMeta);
      (mockImageRepo.deleteWithTransaction as any).mockResolvedValue(true);

      await expect(imageService.deleteImage(companyId, imageId)).resolves.toBeUndefined();
      expect(mockImageRepo.deleteWithTransaction).toHaveBeenCalled();
    });
  });
});

import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CustomerImageLabelService } from "./customer-image-label.service";
import { AppError } from "@/middleware/error-handler";
import type { CustomerImageLabelRepository } from "@/repositories/customer-image-label.repository";
import type { CustomerImageLabel } from "@/types/customer/image/customer_image_label";
import { ObjectId } from "mongodb";
import { logger } from "@/utils/logger";

describe("CustomerImageLabelService Unit Tests", () => {
  let labelService: CustomerImageLabelService;
  let mockLabelRepo: Partial<CustomerImageLabelRepository>;

  const companyId = "comp-1";
  const labelId = "label-10";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockLabelRepo = {
      create: mock(),
      findById: mock(),
      findAll: mock(),
      exists: mock(),
      update: mock(),
      deleteWithTransaction: mock(),
    };

    labelService = new CustomerImageLabelService(
      mockLabelRepo as CustomerImageLabelRepository
    );
  });

  describe("createLabel & getLabel", () => {
    it("should create label successfully", async () => {
      const generatedId = new ObjectId();
      (mockLabelRepo.create as any).mockImplementation((_cid: string, label: any) =>
        Promise.resolve({ ...label, _id: generatedId })
      );

      const result = await labelService.createLabel(companyId, "Salon Ön Cephe");

      expect(result.name).toBe("Salon Ön Cephe");
      expect(result._id).toEqual(generatedId);
    });

    it("should throw AppError(404) if label is not found", async () => {
      (mockLabelRepo.findById as any).mockResolvedValue(null);

      expect(labelService.getLabel(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Label not found", "LABEL_NOT_FOUND")
      );
    });
  });

  describe("updateLabel & deleteLabel", () => {
    it("should throw AppError(404) if label to update does not exist", async () => {
      (mockLabelRepo.exists as any).mockResolvedValue(false);

      expect(
        labelService.updateLabel(companyId, "missing", "Yeni İsim")
      ).rejects.toThrow(new AppError(404, "Label not found", "LABEL_NOT_FOUND"));
    });

    it("should update label successfully", async () => {
      (mockLabelRepo.exists as any).mockResolvedValue(true);
      (mockLabelRepo.update as any).mockResolvedValue({
        _id: new ObjectId(),
        name: "Mutfak",
      });

      const result = await labelService.updateLabel(companyId, labelId, "Mutfak");
      expect(result.name).toBe("Mutfak");
    });

    it("should delete label successfully", async () => {
      (mockLabelRepo.exists as any).mockResolvedValue(true);
      (mockLabelRepo.deleteWithTransaction as any).mockResolvedValue(true);

      await expect(labelService.deleteLabel(companyId, labelId)).resolves.toBeUndefined();
      expect(mockLabelRepo.deleteWithTransaction).toHaveBeenCalledWith(companyId, labelId);
    });
  });
});

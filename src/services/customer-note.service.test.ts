import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CustomerNoteService } from "./customer-note.service";
import { AppError } from "@/middleware/error-handler";
import type { CustomerNoteRepository } from "@/repositories/customer-note.repository";
import type { CustomerRepository } from "@/repositories/customer.repository";
import type { CustomerNoteDb } from "@/types/customer/customer_notes/customer_note";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

describe("CustomerNoteService Unit Tests", () => {
  let noteService: CustomerNoteService;
  let mockNoteRepo: Partial<CustomerNoteRepository>;
  let mockCustomerRepo: Partial<CustomerRepository>;

  const companyId = "comp-1";
  const customerId = "507f1f77bcf86cd799439011";
  const noteId = "note-1";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockNoteRepo = {
      create: mock(),
      findById: mock(),
      findByCustomerId: mock(),
      update: mock(),
      delete: mock(),
    };

    mockCustomerRepo = {
      exists: mock(),
    };

    noteService = new CustomerNoteService(
      mockNoteRepo as CustomerNoteRepository,
      mockCustomerRepo as CustomerRepository
    );
  });

  describe("createNote", () => {
    it("should throw AppError(404) if customer does not exist", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(
        noteService.createNote(companyId, customerId, "u1", "Ölçü alındı")
      ).rejects.toThrow(new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND"));
    });

    it("should create note successfully when customer exists", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockNoteRepo.create as any).mockImplementation((_cid: string, note: any) =>
        Promise.resolve(note)
      );

      const result = await noteService.createNote(companyId, customerId, "u1", "Montaj tamamlandı");

      expect(result.note).toBe("Montaj tamamlandı");
      expect(result.userId).toBe("u1");
      expect(mockNoteRepo.create).toHaveBeenCalled();
    });
  });

  describe("getNote", () => {
    it("should return note if found", async () => {
      const mockNote: CustomerNoteDb = {
        _id: new ObjectId(),
        customerId: new ObjectId(customerId),
        userId: "u1",
        note: "Test notu",
        createdAt: Timestamp.now(),
      };
      (mockNoteRepo.findById as any).mockResolvedValue(mockNote);

      const result = await noteService.getNote(companyId, noteId);
      expect(result).toEqual(mockNote);
    });

    it("should throw AppError(404) if note not found", async () => {
      (mockNoteRepo.findById as any).mockResolvedValue(null);

      expect(noteService.getNote(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Customer note not found", "CUSTOMER_NOTE_NOT_FOUND")
      );
    });
  });

  describe("updateNote & deleteNote", () => {
    it("should throw AppError(404) if updating non-existing note", async () => {
      (mockNoteRepo.findById as any).mockResolvedValue(null);

      expect(
        noteService.updateNote(companyId, "missing", "Güncel metin")
      ).rejects.toThrow(new AppError(404, "Customer note not found", "CUSTOMER_NOTE_NOT_FOUND"));
    });

    it("should delete note successfully", async () => {
      (mockNoteRepo.findById as any).mockResolvedValue({ _id: new ObjectId() });
      (mockNoteRepo.delete as any).mockResolvedValue(true);

      await expect(noteService.deleteNote(companyId, noteId)).resolves.toBeUndefined();
      expect(mockNoteRepo.delete).toHaveBeenCalledWith(companyId, noteId);
    });
  });
});

import { describe, expect, it, mock, beforeEach } from "bun:test";
import { TaskMetaService } from "./task-meta.service";
import { AppError } from "@/middleware/error-handler";
import type { TaskMetaRepository } from "@/repositories/task-meta.repository";
import type { TaskMetaDb } from "@/types/schedule/schedule";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";

describe("TaskMetaService Unit Tests", () => {
  let taskMetaService: TaskMetaService;
  let mockRepo: Partial<TaskMetaRepository>;

  const companyId = "comp-1";
  const metaId = "meta-1";

  beforeEach(() => {
    mockRepo = {
      create: mock(),
      findById: mock(),
      findAll: mock(),
      update: mock(),
    };

    taskMetaService = new TaskMetaService(mockRepo as TaskMetaRepository);
  });

  describe("createTaskMeta", () => {
    it("should trim strings and create task meta", async () => {
      (mockRepo.create as any).mockImplementation((_cid: string, data: any) =>
        Promise.resolve(data)
      );

      const result = await taskMetaService.createTaskMeta(companyId, {
        name: "  Montaj  ",
        description: "  Perde montaj işlemi  ",
      });

      expect(result.name).toBe("Montaj");
      expect(result.description).toBe("Perde montaj işlemi");
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it("should throw error if name is empty", async () => {
      expect(
        taskMetaService.createTaskMeta(companyId, {
          name: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("getTaskMeta", () => {
    it("should return task meta when found", async () => {
      const mockMeta: TaskMetaDb = {
        _id: new ObjectId(),
        name: "Keşif",
        createdAt: Timestamp.now(),
      };
      (mockRepo.findById as any).mockResolvedValue(mockMeta);

      const result = await taskMetaService.getTaskMeta(companyId, metaId);
      expect(result.name).toBe("Keşif");
    });

    it("should throw AppError(404) when not found", async () => {
      (mockRepo.findById as any).mockResolvedValue(null);

      expect(taskMetaService.getTaskMeta(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Task meta bulunamadı", "TASK_META_NOT_FOUND")
      );
    });
  });

  describe("updateTaskMeta & deleteTaskMeta", () => {
    it("should throw AppError(404) if updating non-existent task meta", async () => {
      (mockRepo.findById as any).mockResolvedValue(null);

      expect(
        taskMetaService.updateTaskMeta(companyId, "missing", { name: "Yeni" })
      ).rejects.toThrow(new AppError(404, "Task meta bulunamadı", "TASK_META_NOT_FOUND"));
    });

    it("should update task meta successfully", async () => {
      (mockRepo.findById as any).mockResolvedValue({ _id: new ObjectId() });
      (mockRepo.update as any).mockResolvedValue({
        _id: new ObjectId(),
        name: "Ölçü",
      });

      const result = await taskMetaService.updateTaskMeta(companyId, metaId, {
        name: "Ölçü",
      });
      expect(result.name).toBe("Ölçü");
    });
  });
});

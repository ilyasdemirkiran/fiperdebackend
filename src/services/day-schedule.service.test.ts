import { describe, expect, it, beforeEach, mock, spyOn } from "bun:test";
import { DayScheduleService } from "./day-schedule.service";
import { DayScheduleRepository } from "@/repositories/day-schedule.repository";
import { CustomerRepository } from "@/repositories/customer.repository";
import { TaskMetaRepository } from "@/repositories/task-meta.repository";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";

describe("DayScheduleService", () => {
  let service: DayScheduleService;
  let mockScheduleRepo: Partial<DayScheduleRepository>;
  let mockCustomerRepo: Partial<CustomerRepository>;
  let mockTaskMetaRepo: Partial<TaskMetaRepository>;

  const companyId = "company-123";
  const validDate = "2026-10-15";
  const taskId = new ObjectId().toHexString();
  const customerId = new ObjectId().toHexString();
  const taskMetaId = new ObjectId().toHexString();

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});

    mockScheduleRepo = {
      findByDate: mock(),
      findByTaskId: mock(),
      upsertTask: mock(),
      updateTaskInSchedule: mock(),
      deleteTaskFromSchedule: mock(),
      updateTasksOrder: mock(),
      addTaskNote: mock(),
      updateTaskNote: mock(),
      deleteTaskNote: mock(),
      getYearTasks: mock(),
      getTasksByCustomerId: mock(),
    };

    mockCustomerRepo = {
      exists: mock(),
    };

    mockTaskMetaRepo = {
      findById: mock(),
    };

    service = new DayScheduleService(
      mockScheduleRepo as DayScheduleRepository,
      mockCustomerRepo as CustomerRepository,
      mockTaskMetaRepo as TaskMetaRepository
    );
  });

  describe("getDaySchedule", () => {
    it("should return empty schedule if none exists", async () => {
      (mockScheduleRepo.findByDate as any).mockResolvedValue(null);

      const result = await service.getDaySchedule(companyId, validDate);
      expect(result.date).toBe(validDate);
      expect(result.tasks).toEqual([]);
    });

    it("should return sorted tasks by order", async () => {
      const schedule = {
        date: validDate,
        tasks: [
          { id: "task-2", order: 2, meta: { name: "T2" } },
          { id: "task-0", order: 0, meta: { name: "T0" } },
          { id: "task-1", order: 1, meta: { name: "T1" } },
        ],
      };
      (mockScheduleRepo.findByDate as any).mockResolvedValue(schedule);

      const result = await service.getDaySchedule(companyId, validDate);
      expect(result.tasks[0]!.id).toBe("task-0");
      expect(result.tasks[1]!.id).toBe("task-1");
      expect(result.tasks[2]!.id).toBe("task-2");
    });
  });

  describe("getTaskById", () => {
    it("should throw 404 if task not found", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue(null);

      expect(service.getTaskById(companyId, taskId)).rejects.toThrow(
        new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND")
      );
    });

    it("should return schedule and task if found", async () => {
      const found = {
        schedule: { date: validDate, tasks: [] },
        task: { id: taskId, meta: { name: "Montaj" } },
      };
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue(found);

      const res = await service.getTaskById(companyId, taskId);
      expect(res.task.id).toBe(taskId);
    });
  });

  describe("addTaskToDate", () => {
    it("should throw 404 if taskMetaId does not exist", async () => {
      (mockTaskMetaRepo.findById as any).mockResolvedValue(null);

      expect(
        service.addTaskToDate(companyId, validDate, {
          taskMetaId,
          status: "pending",
        })
      ).rejects.toThrow(new AppError(404, "Seçilen görev tanımı (TaskMeta) bulunamadı", "TASK_META_NOT_FOUND"));
    });

    it("should throw 404 if customerId is given but customer does not exist", async () => {
      (mockTaskMetaRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(taskMetaId),
        name: "Ölçü",
      });
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(
        service.addTaskToDate(companyId, validDate, {
          taskMetaId,
          customerId,
          status: "pending",
        })
      ).rejects.toThrow(new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND"));
    });

    it("should successfully add task with correct order", async () => {
      (mockTaskMetaRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(taskMetaId),
        name: "Ölçü",
        description: "Ölçü alımı",
      });
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockScheduleRepo.findByDate as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: "existing" }],
      });
      (mockScheduleRepo.upsertTask as any).mockImplementation((_c: any, _d: any, task: any) => ({
        date: validDate,
        tasks: [task],
      }));

      const res = await service.addTaskToDate(companyId, validDate, {
        taskMetaId,
        customerId,
        status: "pending",
      });

      expect(mockScheduleRepo.upsertTask).toHaveBeenCalled();
      const calledTask = (mockScheduleRepo.upsertTask as any).mock.calls[0][2];
      expect(calledTask.order).toBe(1); // 1 previous task
      expect(calledTask.customerId?.toString()).toBe(customerId);
    });
  });

  describe("updateTaskStatus", () => {
    it("should throw 404 if task not found", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue(null);

      expect(service.updateTaskStatus(companyId, taskId, "completed")).rejects.toThrow(
        new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND")
      );
    });

    it("should update task status successfully", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId },
      });
      (mockScheduleRepo.updateTaskInSchedule as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: taskId, status: "completed" }],
      });

      const res = await service.updateTaskStatus(companyId, taskId, "completed");
      expect(res.tasks[0]!.status).toBe("completed");
    });
  });

  describe("bindCustomerToTask", () => {
    it("should throw 404 if customer not found", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId },
      });
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(service.bindCustomerToTask(companyId, taskId, customerId)).rejects.toThrow(
        new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND")
      );
    });

    it("should bind customer successfully", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId },
      });
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockScheduleRepo.updateTaskInSchedule as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: taskId, customerId: new ObjectId(customerId) }],
      });

      const res = await service.bindCustomerToTask(companyId, taskId, customerId);
      expect(res.tasks[0]!.customerId).toBeDefined();
    });
  });

  describe("changeTaskDate", () => {
    it("should return same schedule if date is not changed", async () => {
      const scheduleDoc = { date: validDate, tasks: [{ id: taskId }] };
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: scheduleDoc,
        task: scheduleDoc.tasks[0],
      });

      const res = await service.changeTaskDate(companyId, taskId, validDate);
      expect(res.oldSchedule).toBe(scheduleDoc as any);
      expect(res.newSchedule).toBe(scheduleDoc as any);
    });

    it("should move task to new date and reorder remaining tasks", async () => {
      const newDate = "2026-10-16";
      const oldScheduleDoc = {
        date: validDate,
        tasks: [{ id: taskId, order: 0 }, { id: "task-other", order: 1 }],
      };
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: oldScheduleDoc,
        task: oldScheduleDoc.tasks[0],
      });

      (mockScheduleRepo.deleteTaskFromSchedule as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: "task-other", order: 1 }],
      });
      (mockScheduleRepo.updateTasksOrder as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: "task-other", order: 0 }],
      });
      (mockScheduleRepo.findByDate as any).mockResolvedValue({
        date: newDate,
        tasks: [],
      });
      (mockScheduleRepo.upsertTask as any).mockResolvedValue({
        date: newDate,
        tasks: [{ id: taskId, order: 0 }],
      });

      const res = await service.changeTaskDate(companyId, taskId, newDate);
      expect(mockScheduleRepo.deleteTaskFromSchedule).toHaveBeenCalled();
      expect(mockScheduleRepo.upsertTask).toHaveBeenCalled();
      expect(res.newSchedule.date).toBe(newDate);
    });
  });

  describe("deleteTask", () => {
    it("should throw 404 if task not found", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue(null);

      expect(service.deleteTask(companyId, taskId)).rejects.toThrow(
        new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND")
      );
    });

    it("should delete task and re-index remaining orders", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId },
      });
      (mockScheduleRepo.deleteTaskFromSchedule as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: "rem-1", order: 5 }, { id: "rem-2", order: 8 }],
      });
      (mockScheduleRepo.updateTasksOrder as any).mockImplementation((_c: any, _d: any, tasks: any) => ({
        date: validDate,
        tasks,
      }));

      const res = await service.deleteTask(companyId, taskId);
      expect(res.tasks[0]!.order).toBe(0);
      expect(res.tasks[1]!.order).toBe(1);
    });
  });

  describe("reorderDayTasks", () => {
    it("should throw 404 if schedule has no tasks", async () => {
      (mockScheduleRepo.findByDate as any).mockResolvedValue(null);

      expect(service.reorderDayTasks(companyId, validDate, { taskIds: [taskId] })).rejects.toThrow(
        new AppError(404, "Bu tarihe ait görev bulunamadı", "DAY_SCHEDULE_NOT_FOUND")
      );
    });

    it("should reorder tasks and append unmentioned tasks at end", async () => {
      (mockScheduleRepo.findByDate as any).mockResolvedValue({
        date: validDate,
        tasks: [
          { id: "t1", order: 0 },
          { id: "t2", order: 1 },
          { id: "t3", order: 2 },
        ],
      });
      (mockScheduleRepo.updateTasksOrder as any).mockImplementation((_c: any, _d: any, tasks: any) => ({
        date: validDate,
        tasks,
      }));

      const res = await service.reorderDayTasks(companyId, validDate, {
        taskIds: ["t2", "t1"],
      });

      expect(res.tasks[0]!.id).toBe("t2");
      expect(res.tasks[0]!.order).toBe(0);
      expect(res.tasks[1]!.id).toBe("t1");
      expect(res.tasks[1]!.order).toBe(1);
      expect(res.tasks[2]!.id).toBe("t3");
      expect(res.tasks[2]!.order).toBe(2);
    });
  });

  describe("Task Notes CRUD", () => {
    it("should add task note", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId, notes: [] },
      });
      (mockScheduleRepo.addTaskNote as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: taskId, notes: [{ note: "Hello" }] }],
      });

      const res = await service.addTaskNote(companyId, taskId, "user-1", {
        note: "Hello",
      });
      expect(res.tasks[0]!.notes).toHaveLength(1);
    });

    it("should throw 404 if updating non-existent note", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId, notes: [{ id: "note-1" }] },
      });

      expect(
        service.updateTaskNote(companyId, taskId, "note-999", {
          note: "Updated note",
        })
      ).rejects.toThrow(new AppError(404, "Görev notu bulunamadı", "TASK_NOTE_NOT_FOUND"));
    });

    it("should update task note successfully", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId, notes: [{ id: "note-1", note: "Old" }] },
      });
      (mockScheduleRepo.updateTaskNote as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: taskId, notes: [{ id: "note-1", note: "New" }] }],
      });

      const res = await service.updateTaskNote(companyId, taskId, "note-1", {
        note: "New",
      });
      expect(res.tasks[0]!.notes[0]!.note).toBe("New");
    });

    it("should delete task note successfully", async () => {
      (mockScheduleRepo.findByTaskId as any).mockResolvedValue({
        schedule: { date: validDate },
        task: { id: taskId, notes: [{ id: "note-1" }] },
      });
      (mockScheduleRepo.deleteTaskNote as any).mockResolvedValue({
        date: validDate,
        tasks: [{ id: taskId, notes: [] }],
      });

      const res = await service.deleteTaskNote(companyId, taskId, "note-1");
      expect(res.tasks[0]!.notes).toHaveLength(0);
    });
  });

  describe("getYearTasks & getTasksByCustomerId", () => {
    it("should validate year format", async () => {
      expect(service.getYearTasks(companyId, 1800)).rejects.toThrow(
        new AppError(400, "Geçersiz yıl", "INVALID_YEAR")
      );
    });

    it("should return year tasks", async () => {
      (mockScheduleRepo.getYearTasks as any).mockResolvedValue([{ date: "2026-10-15", tasks: [] }]);

      const res = await service.getYearTasks(companyId, 2026);
      expect(res).toHaveLength(1);
    });

    it("should throw 404 for customer tasks if customer does not exist", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(service.getTasksByCustomerId(companyId, customerId)).rejects.toThrow(
        new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND")
      );
    });

    it("should return tasks by customer ID if customer exists", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockScheduleRepo.getTasksByCustomerId as any).mockResolvedValue([{ id: taskId }]);

      const res = await service.getTasksByCustomerId(companyId, customerId);
      expect(res).toHaveLength(1);
    });
  });
});

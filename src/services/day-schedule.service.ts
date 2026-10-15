import {DayScheduleRepository, type CustomerTaskItem, type YearTaskItem} from "@/repositories/day-schedule.repository";
import {CustomerRepository} from "@/repositories/customer.repository";
import {TaskMetaRepository} from "@/repositories/task-meta.repository";
import {
  type CreateTaskInput,
  createTaskInputSchema,
  type CreateTaskNoteInput,
  createTaskNoteInputSchema,
  type DayScheduleDb,
  localDateSchema,
  type ReorderDayTasksInput,
  type ScheduleTask,
  type TaskNote,
  type TaskStatus,
  taskStatusSchema,
  type UpdateTaskNoteInput,
  updateTaskNoteInputSchema,
} from "@/types/schedule/schedule";
import {AppError} from "@/middleware/error-handler";
import {ObjectId} from "mongodb";
import {Timestamp} from "firebase-admin/firestore";

export class DayScheduleService {
  private repository: DayScheduleRepository;
  private customerRepository: CustomerRepository;
  private taskMetaRepository: TaskMetaRepository;

  constructor(
    repository?: DayScheduleRepository,
    customerRepository?: CustomerRepository,
    taskMetaRepository?: TaskMetaRepository
  ) {
    this.repository = repository ?? new DayScheduleRepository();
    this.customerRepository = customerRepository ?? new CustomerRepository();
    this.taskMetaRepository = taskMetaRepository ?? new TaskMetaRepository();
  }

  async getDaySchedule(companyId: string, date: string): Promise<DayScheduleDb> {
    const validatedDate = localDateSchema.parse(date);
    const schedule = await this.repository.findByDate(companyId, validatedDate);

    if (!schedule) {
      return {
        date: validatedDate,
        tasks: [],
        createdAt: Timestamp.now(),
      };
    }

    const sortedTasks = [...schedule.tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return {
      ...schedule,
      tasks: sortedTasks,
    };
  }

  async getTaskById(
    companyId: string,
    taskId: string
  ): Promise<{schedule: DayScheduleDb; task: ScheduleTask}> {
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }
    return found;
  }

  async addTaskToDate(
    companyId: string,
    date: string,
    rawInput: CreateTaskInput
  ): Promise<DayScheduleDb> {
    const validatedDate = localDateSchema.parse(date);
    const input = createTaskInputSchema.parse(rawInput);

    // 1. TaskMeta must exist
    const taskMeta = await this.taskMetaRepository.findById(companyId, input.taskMetaId);
    if (!taskMeta) {
      throw new AppError(404, "Seçilen görev tanımı (TaskMeta) bulunamadı", "TASK_META_NOT_FOUND");
    }

    // 2. Check Customer if provided
    let customerObjectId: ObjectId | null = null;
    if (input.customerId) {
      const exists = await this.customerRepository.exists(companyId, input.customerId);
      if (!exists) {
        throw new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND");
      }
      customerObjectId = new ObjectId(input.customerId);
    }

    const currentSchedule = await this.repository.findByDate(companyId, validatedDate);
    const nextOrder = currentSchedule && currentSchedule.tasks ? currentSchedule.tasks.length : 0;

    const taskId = new ObjectId().toHexString();
    const now = Timestamp.now();

    const newTask: ScheduleTask = {
      id: taskId,
      taskMetaId: taskMeta._id!,
      meta: {
        name: taskMeta.name,
        description: taskMeta.description,
      },
      status: input.status ?? "pending",
      order: nextOrder,
      customerId: customerObjectId,
      notes: [],
      createdAt: now,
    };

    return await this.repository.upsertTask(companyId, validatedDate, newTask, now);
  }

  async updateTaskStatus(
    companyId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<DayScheduleDb> {
    const validatedStatus = taskStatusSchema.parse(status);

    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const {schedule} = found;
    const now = Timestamp.now();

    const updated = await this.repository.updateTaskInSchedule(
      companyId,
      schedule.date,
      taskId,
      {
        status: validatedStatus,
        updatedAt: now,
      },
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev durumu güncellenemedi", "TASK_UPDATE_FAILED");
    }

    return updated;
  }

  async bindCustomerToTask(
    companyId: string,
    taskId: string,
    customerId: string | null | undefined
  ): Promise<DayScheduleDb> {
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    let customerObjectId: ObjectId | null = null;
    if (customerId) {
      const exists = await this.customerRepository.exists(companyId, customerId);
      if (!exists) {
        throw new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND");
      }
      customerObjectId = new ObjectId(customerId);
    }

    const {schedule} = found;
    const now = Timestamp.now();

    const updated = await this.repository.updateTaskInSchedule(
      companyId,
      schedule.date,
      taskId,
      {
        customerId: customerObjectId,
        updatedAt: now,
      },
      now
    );

    if (!updated) {
      throw new AppError(500, "Göreve müşteri bağlanamadı", "TASK_UPDATE_FAILED");
    }

    return updated;
  }

  async changeTaskDate(
    companyId: string,
    taskId: string,
    newDate: string
  ): Promise<{oldSchedule: DayScheduleDb; newSchedule: DayScheduleDb}> {
    const validatedNewDate = localDateSchema.parse(newDate);

    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const {schedule: oldScheduleDoc, task} = found;

    if (oldScheduleDoc.date === validatedNewDate) {
      return {oldSchedule: oldScheduleDoc, newSchedule: oldScheduleDoc};
    }

    const now = Timestamp.now();

    // 1. Delete from old schedule
    const afterDelete = await this.repository.deleteTaskFromSchedule(
      companyId,
      oldScheduleDoc.date,
      taskId,
      now
    );

    // Reorder remaining tasks in old schedule
    const remainingTasks = ((afterDelete && afterDelete.tasks) || []).map((t, index) => ({
      ...t,
      order: index,
    }));

    const finalOldSchedule =
      (await this.repository.updateTasksOrder(companyId, oldScheduleDoc.date, remainingTasks, now)) ||
      afterDelete ||
      oldScheduleDoc;

    // 2. Add to new schedule
    const targetSchedule = await this.repository.findByDate(companyId, validatedNewDate);
    const newOrder = targetSchedule && targetSchedule.tasks ? targetSchedule.tasks.length : 0;

    const taskToMove: ScheduleTask = {
      ...task,
      order: newOrder,
      updatedAt: now,
    };

    const finalNewSchedule = await this.repository.upsertTask(
      companyId,
      validatedNewDate,
      taskToMove,
      now
    );

    return {
      oldSchedule: finalOldSchedule,
      newSchedule: finalNewSchedule,
    };
  }

  async deleteTask(companyId: string, taskId: string): Promise<DayScheduleDb> {
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const {schedule} = found;
    const now = Timestamp.now();

    const updated = await this.repository.deleteTaskFromSchedule(
      companyId,
      schedule.date,
      taskId,
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev silinemedi", "TASK_DELETE_FAILED");
    }

    // Re-index orders for the remaining tasks
    const remainingTasks = (updated.tasks || []).map((t, index) => ({
      ...t,
      order: index,
    }));

    const reordered = await this.repository.updateTasksOrder(
      companyId,
      schedule.date,
      remainingTasks,
      now
    );

    return reordered || updated;
  }

  async reorderDayTasks(
    companyId: string,
    date: string,
    input: ReorderDayTasksInput
  ): Promise<DayScheduleDb> {
    const validatedDate = localDateSchema.parse(date);
    const schedule = await this.repository.findByDate(companyId, validatedDate);

    if (!schedule || !schedule.tasks || schedule.tasks.length === 0) {
      throw new AppError(404, "Bu tarihe ait görev bulunamadı", "DAY_SCHEDULE_NOT_FOUND");
    }

    const taskMap = new Map(schedule.tasks.map((t) => [t.id, t]));
    const reorderedTasks: ScheduleTask[] = [];

    input.taskIds.forEach((id, index) => {
      const task = taskMap.get(id);
      if (task) {
        reorderedTasks.push({
          ...task,
          order: index,
        });
        taskMap.delete(id);
      }
    });

    for (const task of taskMap.values()) {
      reorderedTasks.push({
        ...task,
        order: reorderedTasks.length,
      });
    }

    const now = Timestamp.now();
    const updated = await this.repository.updateTasksOrder(
      companyId,
      validatedDate,
      reorderedTasks,
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev sıralaması güncellenemedi", "REORDER_FAILED");
    }

    return updated;
  }

  // --- Task Notes CRUD ---

  async addTaskNote(
    companyId: string,
    taskId: string,
    userId: string,
    rawInput: CreateTaskNoteInput
  ): Promise<DayScheduleDb> {
    const input = createTaskNoteInputSchema.parse(rawInput);
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const now = Timestamp.now();
    const newNote: TaskNote = {
      id: new ObjectId().toHexString(),
      userId,
      note: input.note.trim(),
      createdAt: now,
    };

    const updated = await this.repository.addTaskNote(
      companyId,
      found.schedule.date,
      taskId,
      newNote,
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev notu eklenemedi", "TASK_NOTE_ADD_FAILED");
    }

    return updated;
  }

  async updateTaskNote(
    companyId: string,
    taskId: string,
    noteId: string,
    rawInput: UpdateTaskNoteInput
  ): Promise<DayScheduleDb> {
    const input = updateTaskNoteInputSchema.parse(rawInput);
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const targetNote = (found.task.notes || []).find((n) => n.id === noteId);
    if (!targetNote) {
      throw new AppError(404, "Görev notu bulunamadı", "TASK_NOTE_NOT_FOUND");
    }

    const now = Timestamp.now();
    const updated = await this.repository.updateTaskNote(
      companyId,
      found.schedule.date,
      taskId,
      noteId,
      input.note.trim(),
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev notu güncellenemedi", "TASK_NOTE_UPDATE_FAILED");
    }

    return updated;
  }

  async deleteTaskNote(
    companyId: string,
    taskId: string,
    noteId: string
  ): Promise<DayScheduleDb> {
    const found = await this.repository.findByTaskId(companyId, taskId);
    if (!found) {
      throw new AppError(404, "Görev bulunamadı", "TASK_NOT_FOUND");
    }

    const targetNote = (found.task.notes || []).find((n) => n.id === noteId);
    if (!targetNote) {
      throw new AppError(404, "Görev notu bulunamadı", "TASK_NOTE_NOT_FOUND");
    }

    const now = Timestamp.now();
    const updated = await this.repository.deleteTaskNote(
      companyId,
      found.schedule.date,
      taskId,
      noteId,
      now
    );

    if (!updated) {
      throw new AppError(500, "Görev notu silinemedi", "TASK_NOTE_DELETE_FAILED");
    }

    return updated;
  }

  async getYearTasks(companyId: string, year: number): Promise<YearTaskItem[]> {
    if (isNaN(year) || year < 1900 || year > 2200) {
      throw new AppError(400, "Geçersiz yıl", "INVALID_YEAR");
    }

    return await this.repository.getYearTasks(companyId, year);
  }

  async getTasksByCustomerId(companyId: string, customerId: string): Promise<CustomerTaskItem[]> {
    const exists = await this.customerRepository.exists(companyId, customerId);
    if (!exists) {
      throw new AppError(404, "Müşteri bulunamadı", "CUSTOMER_NOT_FOUND");
    }

    return await this.repository.getTasksByCustomerId(companyId, customerId);
  }
}

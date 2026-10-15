import {TaskMetaRepository} from "@/repositories/task-meta.repository";
import {
  type CreateTaskMetaInput,
  createTaskMetaInputSchema,
  type TaskMetaDb,
  type UpdateTaskMetaInput,
  updateTaskMetaInputSchema,
} from "@/types/schedule/schedule";
import {AppError} from "@/middleware/error-handler";
import {ObjectId} from "mongodb";
import {Timestamp} from "firebase-admin/firestore";

export class TaskMetaService {
  private repository: TaskMetaRepository;

  constructor(repository?: TaskMetaRepository) {
    this.repository = repository ?? new TaskMetaRepository();
  }

  async createTaskMeta(companyId: string, input: CreateTaskMetaInput): Promise<TaskMetaDb> {
    const validated = createTaskMetaInputSchema.parse(input);
    const now = Timestamp.now();

    const taskMeta: TaskMetaDb = {
      _id: new ObjectId(),
      name: validated.name.trim(),
      description: validated.description?.trim(),
      createdAt: now,
    };

    return await this.repository.create(companyId, taskMeta);
  }

  async getTaskMeta(companyId: string, id: string): Promise<TaskMetaDb> {
    const meta = await this.repository.findById(companyId, id);
    if (!meta) {
      throw new AppError(404, "Task meta bulunamadı", "TASK_META_NOT_FOUND");
    }
    return meta;
  }

  async listTaskMetas(companyId: string): Promise<TaskMetaDb[]> {
    return await this.repository.findAll(companyId);
  }

  async updateTaskMeta(
    companyId: string,
    id: string,
    input: UpdateTaskMetaInput
  ): Promise<TaskMetaDb> {
    const existing = await this.repository.findById(companyId, id);
    if (!existing) {
      throw new AppError(404, "Task meta bulunamadı", "TASK_META_NOT_FOUND");
    }

    const validated = updateTaskMetaInputSchema.parse(input);
    const updates: Partial<TaskMetaDb> = {
      updatedAt: Timestamp.now(),
    };

    if (validated.name !== undefined) {
      updates.name = validated.name.trim();
    }
    if (validated.description !== undefined) {
      updates.description = validated.description.trim();
    }

    const updated = await this.repository.update(companyId, id, updates);
    if (!updated) {
      throw new AppError(500, "Task meta güncellenemedi", "TASK_META_UPDATE_FAILED");
    }
    return updated;
  }
}

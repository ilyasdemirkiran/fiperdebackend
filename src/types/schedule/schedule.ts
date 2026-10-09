import {z} from "zod";
import {ObjectId} from "mongodb";
import {timestampSchema} from "@/types/timestamp";

// Task Status
export const taskStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// Local Date (Java LocalDate format YYYY-MM-DD)
export const localDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const localDateSchema = z
  .string()
  .regex(localDateRegex, "Geçersiz tarih formatı. YYYY-MM-DD formatında olmalıdır (örn: 2026-01-01)");

// Task Meta Definition (CRU - Create, Read, Update - No delete)
export const taskMetaSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  name: z.string().min(1, "Görev adı zorunludur").max(200, "Görev adı en fazla 200 karakter olabilir"),
  description: z.string().max(1000, "Açıklama en fazla 1000 karakter olabilir").optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});
export type TaskMeta = z.infer<typeof taskMetaSchema>;
export type TaskMetaDb = TaskMeta;

export const createTaskMetaInputSchema = z.object({
  name: z.string().min(1, "Görev adı zorunludur").max(200, "Görev adı en fazla 200 karakter olabilir"),
  description: z.string().max(1000, "Açıklama en fazla 1000 karakter olabilir").optional(),
});
export type CreateTaskMetaInput = z.infer<typeof createTaskMetaInputSchema>;

export const updateTaskMetaInputSchema = createTaskMetaInputSchema.partial();
export type UpdateTaskMetaInput = z.infer<typeof updateTaskMetaInputSchema>;

// Task Note
export const taskNoteSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  note: z.string().min(1, "Not içeriği boş olamaz"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});
export type TaskNote = z.infer<typeof taskNoteSchema>;

export const createTaskNoteInputSchema = z.object({
  note: z.string().min(1, "Not içeriği boş olamaz"),
});
export type CreateTaskNoteInput = z.infer<typeof createTaskNoteInputSchema>;

export const updateTaskNoteInputSchema = z.object({
  note: z.string().min(1, "Not içeriği boş olamaz"),
});
export type UpdateTaskNoteInput = z.infer<typeof updateTaskNoteInputSchema>;

// Schedule Task Item
export const scheduleTaskSchema = z.object({
  id: z.string().min(1),
  taskMetaId: z.custom<ObjectId>(),
  meta: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  status: taskStatusSchema.default("pending"),
  order: z.number().int().nonnegative().default(0),
  customerId: z.custom<ObjectId>().optional().nullable(),
  notes: z.array(taskNoteSchema).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});
export type ScheduleTask = z.infer<typeof scheduleTaskSchema>;

// Day Schedule Model
export const dayScheduleSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  date: localDateSchema,
  tasks: z.array(scheduleTaskSchema).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});
export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type DayScheduleDb = DaySchedule;

// DTO Schemas
export const createTaskInputSchema = z.object({
  taskMetaId: z.string().min(1, "Task meta seçilmelidir"),
  status: taskStatusSchema.optional().default("pending"),
  customerId: z.string().optional().nullable(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskStatusInputSchema = z.object({
  status: taskStatusSchema,
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

export const bindTaskCustomerInputSchema = z.object({
  customerId: z.string().nullable().optional(),
});
export type BindTaskCustomerInput = z.infer<typeof bindTaskCustomerInputSchema>;

export const changeTaskDateInputSchema = z.object({
  newDate: localDateSchema,
});
export type ChangeTaskDateInput = z.infer<typeof changeTaskDateInputSchema>;

export const reorderDayTasksInputSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1, "En az bir task id gönderilmelidir"),
});
export type ReorderDayTasksInput = z.infer<typeof reorderDayTasksInputSchema>;

export const listYearTasksQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
});
export type ListYearTasksQuery = z.infer<typeof listYearTasksQuerySchema>;

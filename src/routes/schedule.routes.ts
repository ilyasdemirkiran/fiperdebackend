import {Hono} from "hono";
import type {Env} from "@/types/hono";
import {DayScheduleService} from "@/services/day-schedule.service";
import {TaskMetaService} from "@/services/task-meta.service";
import {successResponse} from "@/utils/response";
import {authMiddleware} from "@/middleware/auth";
import {toResponse, toResponseArray} from "@/utils/response-transformer";
import {
  bindTaskCustomerInputSchema,
  changeTaskDateInputSchema,
  createTaskInputSchema,
  createTaskMetaInputSchema,
  createTaskNoteInputSchema,
  listYearTasksQuerySchema,
  reorderDayTasksInputSchema,
  updateTaskMetaInputSchema,
  updateTaskNoteInputSchema,
  updateTaskStatusInputSchema,
} from "@/types/schedule/schedule";

export const scheduleRoutes = new Hono<Env>();

let scheduleService: DayScheduleService | null = null;
let taskMetaService: TaskMetaService | null = null;

function getScheduleService(): DayScheduleService {
  if (!scheduleService) {
    scheduleService = new DayScheduleService();
  }
  return scheduleService;
}

function getTaskMetaService(): TaskMetaService {
  if (!taskMetaService) {
    taskMetaService = new TaskMetaService();
  }
  return taskMetaService;
}

// Apply auth middleware to all schedule routes
scheduleRoutes.use("*", authMiddleware);

// ==========================================
// 1. Task Meta Endpoints (CRU - No Delete)
// ==========================================

// GET /api/schedules/metas - List all task metas for company
scheduleRoutes.get("/metas", async (c) => {
  const user = c.get("user");
  const metas = await getTaskMetaService().listTaskMetas(user.companyId!);
  return c.json(successResponse(toResponseArray(metas)));
});

// POST /api/schedules/metas - Create a new task meta
scheduleRoutes.post("/metas", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = createTaskMetaInputSchema.parse(body);

  const created = await getTaskMetaService().createTaskMeta(user.companyId!, input);
  return c.json(successResponse(toResponse(created)), 201);
});

// GET /api/schedules/metas/:id - Get single task meta
scheduleRoutes.get("/metas/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const meta = await getTaskMetaService().getTaskMeta(user.companyId!, id);
  return c.json(successResponse(toResponse(meta)));
});

// PUT /api/schedules/metas/:id - Update task meta (name/description)
scheduleRoutes.put("/metas/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = updateTaskMetaInputSchema.parse(body);

  const updated = await getTaskMetaService().updateTaskMeta(user.companyId!, id, input);
  return c.json(successResponse(toResponse(updated)));
});

// ==========================================
// 2. Day Schedule & Tasks Endpoints
// ==========================================

// GET /api/schedules/year?year=2026 - List all tasks for a specific year
scheduleRoutes.get("/year", async (c) => {
  const user = c.get("user");
  const query = listYearTasksQuerySchema.parse(
    Object.fromEntries(new URL(c.req.url).searchParams)
  );

  const tasks = await getScheduleService().getYearTasks(user.companyId!, query.year);
  return c.json(successResponse(toResponseArray(tasks)));
});

// GET /api/schedules/days/:date - Get day schedule for a specific local date (YYYY-MM-DD)
scheduleRoutes.get("/days/:date", async (c) => {
  const user = c.get("user");
  const date = c.req.param("date");

  const daySchedule = await getScheduleService().getDaySchedule(user.companyId!, date);
  return c.json(successResponse(toResponse(daySchedule)));
});

// POST /api/schedules/days/:date/tasks - Add a new task to a specific date using taskMetaId
scheduleRoutes.post("/days/:date/tasks", async (c) => {
  const user = c.get("user");
  const date = c.req.param("date");
  const body = await c.req.json();

  const input = createTaskInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().addTaskToDate(user.companyId!, date, input);

  return c.json(successResponse(toResponse(updatedSchedule)), 201);
});

// PUT /api/schedules/days/:date/reorder - Reorder tasks within a specific date
scheduleRoutes.put("/days/:date/reorder", async (c) => {
  const user = c.get("user");
  const date = c.req.param("date");
  const body = await c.req.json();

  const input = reorderDayTasksInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().reorderDayTasks(user.companyId!, date, input);

  return c.json(successResponse(toResponse(updatedSchedule)));
});

// GET /api/schedules/tasks/:taskId - Get single task with its schedule context
scheduleRoutes.get("/tasks/:taskId", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");

  const result = await getScheduleService().getTaskById(user.companyId!, taskId);
  return c.json(successResponse(toResponse(result)));
});

// PATCH /api/schedules/tasks/:taskId/status - Update task status
scheduleRoutes.patch("/tasks/:taskId/status", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const body = await c.req.json();

  const input = updateTaskStatusInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().updateTaskStatus(user.companyId!, taskId, input.status);

  return c.json(successResponse(toResponse(updatedSchedule)));
});

// PATCH /api/schedules/tasks/:taskId/customer - Bind / unbind customer to task
scheduleRoutes.patch("/tasks/:taskId/customer", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const body = await c.req.json();

  const input = bindTaskCustomerInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().bindCustomerToTask(user.companyId!, taskId, input.customerId);

  return c.json(successResponse(toResponse(updatedSchedule)));
});

// PATCH /api/schedules/tasks/:taskId/date - Change task date (move to another day)
scheduleRoutes.patch("/tasks/:taskId/date", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const body = await c.req.json();

  const input = changeTaskDateInputSchema.parse(body);
  const result = await getScheduleService().changeTaskDate(user.companyId!, taskId, input.newDate);

  return c.json(successResponse(toResponse(result)));
});

// DELETE /api/schedules/tasks/:taskId - Delete a task
scheduleRoutes.delete("/tasks/:taskId", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");

  const updatedSchedule = await getScheduleService().deleteTask(user.companyId!, taskId);
  return c.json(successResponse(toResponse(updatedSchedule)));
});

// ==========================================
// 3. Task Notes Endpoints (CRUD)
// ==========================================

// POST /api/schedules/tasks/:taskId/notes - Add note to task
scheduleRoutes.post("/tasks/:taskId/notes", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const body = await c.req.json();

  const input = createTaskNoteInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().addTaskNote(
    user.companyId!,
    taskId,
    user._id!,
    input
  );

  return c.json(successResponse(toResponse(updatedSchedule)), 201);
});

// PUT /api/schedules/tasks/:taskId/notes/:noteId - Update task note
scheduleRoutes.put("/tasks/:taskId/notes/:noteId", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const noteId = c.req.param("noteId");
  const body = await c.req.json();

  const input = updateTaskNoteInputSchema.parse(body);
  const updatedSchedule = await getScheduleService().updateTaskNote(
    user.companyId!,
    taskId,
    noteId,
    input
  );

  return c.json(successResponse(toResponse(updatedSchedule)));
});

// DELETE /api/schedules/tasks/:taskId/notes/:noteId - Delete task note
scheduleRoutes.delete("/tasks/:taskId/notes/:noteId", async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const noteId = c.req.param("noteId");

  const updatedSchedule = await getScheduleService().deleteTaskNote(
    user.companyId!,
    taskId,
    noteId
  );

  return c.json(successResponse(toResponse(updatedSchedule)));
});

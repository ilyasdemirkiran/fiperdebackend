import type {Collection} from "mongodb";
import {getDatabaseForCompany} from "@/config/database";
import type {DayScheduleDb, TaskMetaDb} from "@/types/schedule/schedule";

export const SCHEDULE_COLLECTIONS = {
  daySchedules: "day_schedules",
  taskMetas: "task_metas",
};

export function getDaySchedulesCollection(companyId: string): Collection<DayScheduleDb> {
  return getDatabaseForCompany(companyId).collection<DayScheduleDb>(SCHEDULE_COLLECTIONS.daySchedules);
}

export function getTaskMetasCollection(companyId: string): Collection<TaskMetaDb> {
  return getDatabaseForCompany(companyId).collection<TaskMetaDb>(SCHEDULE_COLLECTIONS.taskMetas);
}

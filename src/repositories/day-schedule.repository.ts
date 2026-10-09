import {Collection, type Document, ObjectId} from "mongodb";
import type {DayScheduleDb, ScheduleTask, TaskNote} from "@/types/schedule/schedule";
import {getDaySchedulesCollection} from "@/repositories/collections/schedule.collections";
import {logger} from "@/utils/logger";

export interface YearTaskItem {
  date: string;
  task: ScheduleTask;
  customer?: {
    _id: ObjectId;
    name: string;
    surname: string;
    phone?: string;
  };
}

export interface CustomerTaskItem {
  date: string;
  task: ScheduleTask;
}

export class DayScheduleRepository {
  private getCollection(companyId: string): Collection<DayScheduleDb> {
    return getDaySchedulesCollection(companyId);
  }

  async findByDate(companyId: string, date: string): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({date});
    } catch (error) {
      logger.error("Failed to find day schedule by date", error);
      throw error;
    }
  }

  async upsertTask(
    companyId: string,
    date: string,
    task: ScheduleTask,
    now: any
  ): Promise<DayScheduleDb> {
    try {
      const collection = this.getCollection(companyId);

      // Upsert the document for the date if not exists, and push the task
      const result = await collection.findOneAndUpdate(
        {date},
        {
          $setOnInsert: {
            _id: new ObjectId(),
            date,
            createdAt: now,
          },
          $set: {
            updatedAt: now,
          },
          $push: {
            tasks: task,
          },
        },
        {upsert: true, returnDocument: "after"}
      );

      if (!result) {
        throw new Error("Failed to upsert task into day schedule");
      }

      return result;
    } catch (error) {
      logger.error("Failed to add task to day schedule", error);
      throw error;
    }
  }

  async findByTaskId(
    companyId: string,
    taskId: string
  ): Promise<{schedule: DayScheduleDb; task: ScheduleTask} | null> {
    try {
      const collection = this.getCollection(companyId);
      const schedule = await collection.findOne({"tasks.id": taskId});
      if (!schedule) {
        return null;
      }
      const task = schedule.tasks.find((t) => t.id === taskId);
      if (!task) {
        return null;
      }
      return {schedule, task};
    } catch (error) {
      logger.error("Failed to find schedule by taskId", error);
      throw error;
    }
  }

  async updateTaskInSchedule(
    companyId: string,
    date: string,
    taskId: string,
    updates: Partial<ScheduleTask>,
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const setFields: Record<string, any> = {
        updatedAt: now,
      };

      for (const [key, val] of Object.entries(updates)) {
        setFields[`tasks.$.${key}`] = val;
      }

      const result = await collection.findOneAndUpdate(
        {date, "tasks.id": taskId},
        {$set: setFields},
        {returnDocument: "after"}
      );

      return result;
    } catch (error) {
      logger.error("Failed to update task in schedule", error);
      throw error;
    }
  }

  async deleteTaskFromSchedule(
    companyId: string,
    date: string,
    taskId: string,
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const result = await collection.findOneAndUpdate(
        {date},
        {
          $pull: {tasks: {id: taskId} as any},
          $set: {updatedAt: now},
        },
        {returnDocument: "after"}
      );

      return result;
    } catch (error) {
      logger.error("Failed to delete task from schedule", error);
      throw error;
    }
  }

  async updateTasksOrder(
    companyId: string,
    date: string,
    tasks: ScheduleTask[],
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const result = await collection.findOneAndUpdate(
        {date},
        {
          $set: {
            tasks,
            updatedAt: now,
          },
        },
        {returnDocument: "after"}
      );

      return result;
    } catch (error) {
      logger.error("Failed to reorder tasks in schedule", error);
      throw error;
    }
  }

  async addTaskNote(
    companyId: string,
    date: string,
    taskId: string,
    note: TaskNote,
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const result = await collection.findOneAndUpdate(
        {date, "tasks.id": taskId},
        {
          $push: {"tasks.$.notes": note as any},
          $set: {
            "tasks.$.updatedAt": now,
            updatedAt: now,
          },
        },
        {returnDocument: "after"}
      );

      return result;
    } catch (error) {
      logger.error("Failed to add task note", error);
      throw error;
    }
  }

  async updateTaskNote(
    companyId: string,
    date: string,
    taskId: string,
    noteId: string,
    noteText: string,
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const result = await collection.findOneAndUpdate(
        {date, "tasks.id": taskId},
        {
          $set: {
            "tasks.$[t].notes.$[n].note": noteText,
            "tasks.$[t].notes.$[n].updatedAt": now,
            "tasks.$[t].updatedAt": now,
            updatedAt: now,
          },
        },
        {
          arrayFilters: [{"t.id": taskId}, {"n.id": noteId}],
          returnDocument: "after",
        }
      );

      return result;
    } catch (error) {
      logger.error("Failed to update task note", error);
      throw error;
    }
  }

  async deleteTaskNote(
    companyId: string,
    date: string,
    taskId: string,
    noteId: string,
    now: any
  ): Promise<DayScheduleDb | null> {
    try {
      const collection = this.getCollection(companyId);

      const result = await collection.findOneAndUpdate(
        {date, "tasks.id": taskId},
        {
          $pull: {
            "tasks.$.notes": {id: noteId} as any,
          },
          $set: {
            "tasks.$.updatedAt": now,
            updatedAt: now,
          },
        },
        {returnDocument: "after"}
      );

      return result;
    } catch (error) {
      logger.error("Failed to delete task note", error);
      throw error;
    }
  }

  async getYearTasks(companyId: string, year: number): Promise<YearTaskItem[]> {
    try {
      const collection = this.getCollection(companyId);
      const yearPrefix = `^${year}-`;

      const pipeline: Document[] = [
        {$match: {date: {$regex: yearPrefix}}},
        {$unwind: "$tasks"},
        {$sort: {"date": 1, "tasks.order": 1}},
        {
          $lookup: {
            from: "customers",
            localField: "tasks.customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $unwind: {
            path: "$customer",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            date: "$date",
            task: "$tasks",
            customer: {
              $cond: {
                if: {$gt: ["$customer", null]},
                then: {
                  _id: "$customer._id",
                  name: "$customer.name",
                  surname: "$customer.surname",
                  phone: "$customer.phone",
                },
                else: null,
              },
            },
          },
        },
      ];

      const results = await collection.aggregate<YearTaskItem>(pipeline).toArray();
      return results;
    } catch (error) {
      logger.error("Failed to aggregate year tasks", error);
      throw error;
    }
  }

  async getTasksByCustomerId(companyId: string, customerId: string): Promise<CustomerTaskItem[]> {
    try {
      const collection = this.getCollection(companyId);
      const customerObjectId = new ObjectId(customerId);

      const pipeline: Document[] = [
        {$match: {"tasks.customerId": customerObjectId}},
        {$unwind: "$tasks"},
        {$match: {"tasks.customerId": customerObjectId}},
        {$sort: {date: -1, "tasks.order": 1}},
        {
          $project: {
            _id: 0,
            date: "$date",
            task: "$tasks",
          },
        },
      ];

      const results = await collection.aggregate<CustomerTaskItem>(pipeline).toArray();
      return results;
    } catch (error) {
      logger.error("Failed to get tasks by customerId", error);
      throw error;
    }
  }
}

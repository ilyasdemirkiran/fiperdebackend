import {Collection, ObjectId} from "mongodb";
import type {TaskMetaDb} from "@/types/schedule/schedule";
import {getTaskMetasCollection} from "@/repositories/collections/schedule.collections";
import {logger} from "@/utils/logger";

export class TaskMetaRepository {
  private getCollection(companyId: string): Collection<TaskMetaDb> {
    return getTaskMetasCollection(companyId);
  }

  async create(companyId: string, meta: TaskMetaDb): Promise<TaskMetaDb> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(meta as any);
      logger.info("TaskMeta created", {metaId: meta._id, companyId});
      return meta;
    } catch (error) {
      logger.error("Failed to create task meta", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<TaskMetaDb | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({_id: new ObjectId(id)} as any);
    } catch (error) {
      logger.error("Failed to find task meta by ID", error);
      throw error;
    }
  }

  async findAll(companyId: string): Promise<TaskMetaDb[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.find({} as any).sort({name: 1}).toArray();
    } catch (error) {
      logger.error("Failed to list task metas", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<TaskMetaDb>
  ): Promise<TaskMetaDb | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        {_id: new ObjectId(id)} as any,
        {$set: updates},
        {returnDocument: "after"}
      );
      if (result) {
        logger.info("TaskMeta updated", {metaId: id, companyId});
      }
      return result;
    } catch (error) {
      logger.error("Failed to update task meta", error);
      throw error;
    }
  }
}

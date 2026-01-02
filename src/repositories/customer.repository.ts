import { Collection } from "mongodb";
import { getDatabaseForCompany } from "@/config/database";
import { CustomerDb } from "@/types/customer/customer";
import { logger } from "@/utils/logger";

export class CustomerRepository {
  private getCollection(companyId: string): Collection<CustomerDb> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<CustomerDb>("customers");
  }

  async create(companyId: string, customer: CustomerDb): Promise<CustomerDb> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(customer as any);
      logger.info("Customer created", { customerId: customer.id, companyId });
      return customer;
    } catch (error) {
      logger.error("Failed to create customer", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerDb | null> {
    try {
      const collection = this.getCollection(companyId);
      const customer = await collection.findOne(
        { id } as any,
        { projection: { _id: 0 } }
      );
      return customer;
    } catch (error) {
      logger.error("Failed to find customer by ID", error);
      throw error;
    }
  }

  async findAll(
    companyId: string,
    options: {
      page: number;
      limit: number;
      status?: string;
      search?: string;
    }
  ): Promise<{ customers: CustomerDb[]; total: number }> {
    try {
      const collection = this.getCollection(companyId);
      const { page, limit, status, search } = options;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (status) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { surname: { $regex: search, $options: "i" } },
        ];
      }

      // Execute queries in parallel
      const [customers, total] = await Promise.all([
        collection
          .find(query, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(query),
      ]);

      logger.debug("Customers fetched", { companyId, count: customers.length, total });

      return { customers, total };
    } catch (error) {
      logger.error("Failed to fetch customers", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<CustomerDb>
  ): Promise<CustomerDb | null> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.findOneAndUpdate(
        { id } as any,
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: "after", projection: { _id: 0 } }
      );

      if (result) {
        logger.info("Customer updated", { customerId: id, companyId });
      }

      return result;
    } catch (error) {
      logger.error("Failed to update customer", error);
      throw error;
    }
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ id } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Customer deleted", { customerId: id, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete customer", error);
      throw error;
    }
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check customer existence", error);
      throw error;
    }
  }
}

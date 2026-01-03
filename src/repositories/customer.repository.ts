import { Collection, ObjectId, ClientSession } from "mongodb";
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
      logger.info("Customer created", { customerId: customer._id, companyId });
      return customer;
    } catch (error) {
      logger.error("Failed to create customer", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<CustomerDb | null> {
    try {
      const collection = this.getCollection(companyId);
      const customer = await collection.findOne({ _id: new ObjectId(id) } as any);
      return customer;
    } catch (error) {
      logger.error("Failed to find customer by ID", error);
      throw error;
    }
  }

  async getAll(companyId: string): Promise<CustomerDb[]> {
    try {
      const collection = this.getCollection(companyId);
      const customers = await collection
        .find({ status: "active" }) // Only active customers by default for dropdowns etc.
        .sort({ name: 1, surname: 1 })
        .toArray();

      return customers;
    } catch (error) {
      logger.error("Failed to fetch all customers", error);
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
          .find(query)
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
        { _id: new ObjectId(id) } as any,
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: "after" }
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

  async delete(companyId: string, id: string, session?: ClientSession): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ _id: new ObjectId(id) } as any, { session });
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
      const count = await collection.countDocuments({ _id: new ObjectId(id) } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check customer existence", error);
      throw error;
    }
  }
}

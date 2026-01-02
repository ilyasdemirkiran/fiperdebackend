import { Collection } from "mongodb";
import { getDatabaseForCompany } from "@/config/database";
import { Sale, SaleStatus } from "@/types/customer/sale/sale";
import PaymentLog from "@/types/customer/sale/payment_log";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";

export class SaleRepository {
  private getCollection(companyId: string): Collection<Sale> {
    const db = getDatabaseForCompany(companyId);
    return db.collection<Sale>("sales");
  }

  async create(companyId: string, sale: Sale): Promise<Sale> {
    try {
      const collection = this.getCollection(companyId);
      await collection.insertOne(sale as any);
      logger.info("Sale created", { saleId: sale.id, customerId: sale.customerId, companyId });
      return sale;
    } catch (error) {
      logger.error("Failed to create sale", error);
      throw error;
    }
  }

  async findById(companyId: string, id: string): Promise<Sale | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOne({ id } as any, { projection: { _id: 0 } });
    } catch (error) {
      logger.error("Failed to find sale by ID", error);
      throw error;
    }
  }

  async findByCustomerId(companyId: string, customerId: string): Promise<Sale[]> {
    try {
      const collection = this.getCollection(companyId);
      return await collection
        .find({ customerId } as any, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      logger.error("Failed to fetch sales by customerId", error);
      throw error;
    }
  }

  async update(
    companyId: string,
    id: string,
    updates: Partial<Sale>
  ): Promise<Sale | null> {
    try {
      const collection = this.getCollection(companyId);
      return await collection.findOneAndUpdate(
        { id } as any,
        { $set: { ...updates, updatedAt: Timestamp.now() } },
        { returnDocument: "after", projection: { _id: 0 } }
      );
    } catch (error) {
      logger.error("Failed to update sale", error);
      throw error;
    }
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const result = await collection.deleteOne({ id } as any);
      const deleted = result.deletedCount > 0;

      if (deleted) {
        logger.info("Sale deleted", { saleId: id, companyId });
      }

      return deleted;
    } catch (error) {
      logger.error("Failed to delete sale", error);
      throw error;
    }
  }

  /**
   * Add payment log to sale and recalculate status
   */
  async addPaymentLog(
    companyId: string,
    saleId: string,
    paymentLog: PaymentLog
  ): Promise<Sale | null> {
    try {
      const collection = this.getCollection(companyId);

      // Get current sale
      const sale = await this.findById(companyId, saleId);
      if (!sale) return null;

      // Calculate new totalPaidAmount
      const newTotalPaid = sale.totalPaidAmount + paymentLog.amount;
      const newStatus: SaleStatus = newTotalPaid >= sale.totalAmount ? "completed" : "pending";

      // Update sale with new log and recalculated values
      return await collection.findOneAndUpdate(
        { id: saleId } as any,
        {
          $push: { logs: paymentLog } as any,
          $set: {
            totalPaidAmount: Math.round(newTotalPaid * 100) / 100,
            status: newStatus,
            updatedAt: Timestamp.now(),
          },
        },
        { returnDocument: "after", projection: { _id: 0 } }
      );
    } catch (error) {
      logger.error("Failed to add payment log", error);
      throw error;
    }
  }

  /**
   * Update payment log in sale and recalculate status
   */
  async updatePaymentLog(
    companyId: string,
    saleId: string,
    logId: string,
    updates: Partial<Pick<PaymentLog, "amount" | "currency" | "paymentType" | "description">>
  ): Promise<Sale | null> {
    try {
      const collection = this.getCollection(companyId);

      // Get current sale
      const sale = await this.findById(companyId, saleId);
      if (!sale) return null;

      // Find and update the log
      const logIndex = sale.logs.findIndex((log) => log.id === logId);
      if (logIndex === -1) return null;

      const oldAmount = sale.logs[logIndex].amount;
      const newAmount = updates.amount ?? oldAmount;

      // Update log in array
      const updatedLogs = [...sale.logs];
      updatedLogs[logIndex] = { ...updatedLogs[logIndex], ...updates };

      // Recalculate totalPaidAmount
      const newTotalPaid = sale.totalPaidAmount - oldAmount + newAmount;
      const newStatus: SaleStatus = newTotalPaid >= sale.totalAmount ? "completed" : "pending";

      return await collection.findOneAndUpdate(
        { id: saleId } as any,
        {
          $set: {
            logs: updatedLogs,
            totalPaidAmount: Math.round(newTotalPaid * 100) / 100,
            status: newStatus,
            updatedAt: Timestamp.now(),
          },
        },
        { returnDocument: "after", projection: { _id: 0 } }
      );
    } catch (error) {
      logger.error("Failed to update payment log", error);
      throw error;
    }
  }

  /**
   * Delete payment log from sale and recalculate status
   */
  async deletePaymentLog(
    companyId: string,
    saleId: string,
    logId: string
  ): Promise<Sale | null> {
    try {
      const collection = this.getCollection(companyId);

      // Get current sale
      const sale = await this.findById(companyId, saleId);
      if (!sale) return null;

      // Find the log to delete
      const log = sale.logs.find((l) => l.id === logId);
      if (!log) return null;

      // Recalculate totalPaidAmount
      const newTotalPaid = sale.totalPaidAmount - log.amount;
      const newStatus: SaleStatus = newTotalPaid >= sale.totalAmount ? "completed" : "pending";

      return await collection.findOneAndUpdate(
        { id: saleId } as any,
        {
          $pull: { logs: { id: logId } } as any,
          $set: {
            totalPaidAmount: Math.round(newTotalPaid * 100) / 100,
            status: newStatus,
            updatedAt: Timestamp.now(),
          },
        },
        { returnDocument: "after", projection: { _id: 0 } }
      );
    } catch (error) {
      logger.error("Failed to delete payment log", error);
      throw error;
    }
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(companyId);
      const count = await collection.countDocuments({ id } as any);
      return count > 0;
    } catch (error) {
      logger.error("Failed to check sale existence", error);
      throw error;
    }
  }
}

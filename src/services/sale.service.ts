import { SaleRepository } from "@/repositories/sale.repository";
import { Sale, AddSale, addSaleSchema, AddPaymentLog, addPaymentLogSchema, UpdatePaymentLog, updatePaymentLogSchema } from "@/types/customer/sale/sale";
import PaymentLog from "@/types/customer/sale/payment_log";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";
import { UserRole } from "@/types/user/fi_user";
import { ObjectId } from "mongodb";

export class SaleService {
  private repository: SaleRepository;

  constructor() {
    this.repository = new SaleRepository();
  }

  private assertAdmin(role: UserRole): void {
    if (role !== "admin" && role !== "sudo") {
      throw new AppError(403, "Only admin users can perform this operation", "FORBIDDEN");
    }
  }

  async createSale(
    companyId: string,
    userId: string,
    userName: string,
    role: UserRole,
    input: AddSale
  ): Promise<Sale> {
    this.assertAdmin(role);

    const validatedInput = addSaleSchema.parse(input);

    // Calculate initial status
    const totalPaidAmount = validatedInput.logs?.reduce((sum, log) => sum + log.amount, 0) || 0;
    const status = totalPaidAmount >= validatedInput.totalAmount ? "completed" : "pending";

    // Omit _id - MongoDB will auto-generate ObjectId
    const sale: Omit<Sale, "_id"> = {
      customerId: validatedInput.customerId,
      createdByUserId: userId,
      createdByUserName: userName,
      totalAmount: validatedInput.totalAmount,
      totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
      currency: validatedInput.currency,
      status,
      description: validatedInput.description,
      createdAt: Timestamp.now(),
      logs: validatedInput.logs || [],
    };

    return await this.repository.create(companyId, sale);
  }

  async getSale(companyId: string, saleId: string): Promise<Sale> {
    const sale = await this.repository.findById(companyId, saleId);

    if (!sale) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    return sale;
  }

  async listSalesByCustomer(companyId: string, customerId: string): Promise<Sale[]> {
    return await this.repository.findByCustomerId(companyId, customerId);
  }

  async updateSale(
    companyId: string,
    saleId: string,
    role: UserRole,
    updates: Partial<Pick<Sale, "totalAmount" | "currency" | "description">>
  ): Promise<Sale> {
    this.assertAdmin(role);

    const sale = await this.repository.findById(companyId, saleId);
    if (!sale) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    // If totalAmount changed, recalculate status
    if (updates.totalAmount !== undefined) {
      const newStatus = sale.totalPaidAmount >= updates.totalAmount ? "completed" : "pending";
      (updates as any).status = newStatus;
    }

    const updated = await this.repository.update(companyId, saleId, updates);

    if (!updated) {
      throw new AppError(500, "Failed to update sale", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteSale(companyId: string, saleId: string, role: UserRole): Promise<void> {
    this.assertAdmin(role);

    const exists = await this.repository.exists(companyId, saleId);
    if (!exists) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    const deleted = await this.repository.delete(companyId, saleId);
    if (!deleted) {
      throw new AppError(500, "Failed to delete sale", "DELETE_FAILED");
    }

    logger.info("Sale deleted successfully", { saleId, companyId });
  }

  // Payment Log Operations

  async addPaymentLog(
    companyId: string,
    saleId: string,
    userId: string,
    userName: string,
    role: UserRole,
    input: AddPaymentLog
  ): Promise<Sale> {
    this.assertAdmin(role);

    const sale = await this.repository.findById(companyId, saleId);
    if (!sale) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    const validatedInput = addPaymentLogSchema.parse(input);

    // Generate _id manually for subdocument
    const paymentLog: PaymentLog = {
      _id: new ObjectId(),
      saleId,
      customerId: sale.customerId,
      createdByUserId: userId,
      createdByUserName: userName,
      amount: validatedInput.amount,
      currency: validatedInput.currency,
      paymentType: validatedInput.paymentType,
      description: validatedInput.description,
      paymentDate: Timestamp.now(),
      createdAt: Timestamp.now(),
    };

    const updated = await this.repository.addPaymentLog(companyId, saleId, paymentLog);

    if (!updated) {
      throw new AppError(500, "Failed to add payment log", "UPDATE_FAILED");
    }

    logger.info("Payment log added", { saleId, companyId });
    return updated;
  }

  async updatePaymentLog(
    companyId: string,
    saleId: string,
    logId: string,
    role: UserRole,
    input: Partial<Pick<PaymentLog, "amount" | "currency" | "paymentType" | "description">>
  ): Promise<Sale> {
    this.assertAdmin(role);

    const sale = await this.repository.findById(companyId, saleId);
    if (!sale) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    const log = sale.logs.find((l) => l._id?.toString() === logId);
    if (!log) {
      throw new AppError(404, "Payment log not found", "PAYMENT_LOG_NOT_FOUND");
    }

    const updated = await this.repository.updatePaymentLog(companyId, saleId, logId, input);

    if (!updated) {
      throw new AppError(500, "Failed to update payment log", "UPDATE_FAILED");
    }

    logger.info("Payment log updated", { logId, saleId, companyId });
    return updated;
  }

  async deletePaymentLog(
    companyId: string,
    saleId: string,
    logId: string,
    role: UserRole
  ): Promise<Sale> {
    this.assertAdmin(role);

    const sale = await this.repository.findById(companyId, saleId);
    if (!sale) {
      throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    }

    const log = sale.logs.find((l) => l._id?.toString() === logId);
    if (!log) {
      throw new AppError(404, "Payment log not found", "PAYMENT_LOG_NOT_FOUND");
    }

    const updated = await this.repository.deletePaymentLog(companyId, saleId, logId);

    if (!updated) {
      throw new AppError(500, "Failed to delete payment log", "DELETE_FAILED");
    }

    logger.info("Payment log deleted", { logId, saleId, companyId });
    return updated;
  }
}

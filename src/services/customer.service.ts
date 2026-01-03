import { CustomerRepository } from "@/repositories/customer.repository";
import { CustomerImageRepository } from "@/repositories/customer-image.repository";
import { getClient } from "@/config/database";
import {
    CreateCustomerInput,
    UpdateCustomerInput,
    CustomerDb,
    createCustomerSchema,
    updateCustomerSchema,
} from "@/types/customer/customer";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import { FIUser, UserRole } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";

export class CustomerService {
    private repository: CustomerRepository;

    constructor() {
        this.repository = new CustomerRepository();
    }

    async createCustomer(
        companyId: string,
        input: CreateCustomerInput
    ): Promise<CustomerDb> {
        // Validate input
        const validatedInput = createCustomerSchema.parse(input);
        // Omit _id - MongoDB will auto-generate ObjectId
        const customer: Omit<CustomerDb, "_id"> = {
            ...validatedInput,
            status: validatedInput.status || "active",
            address: validatedInput.address || "",
            imageCount: 0,
            createdAt: Timestamp.now(),
        };

        return await this.repository.create(companyId, customer);
    }

    async getCustomer(companyId: string, id: string): Promise<CustomerDb> {
        const customer = await this.repository.findById(companyId, id);

        if (!customer) {
            throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
        }

        return customer;
    }

    async listCustomers(
        companyId: string,
        options: {
            page: number;
            limit: number;
            status?: string;
            search?: string;
        }
    ): Promise<{ customers: CustomerDb[]; total: number }> {
        return await this.repository.findAll(companyId, options);
    }

    async getAllCustomers(companyId: string): Promise<CustomerDb[]> {
        return await this.repository.getAll(companyId);
    }


    async updateCustomer(
        companyId: string,
        id: string,
        input: UpdateCustomerInput
    ): Promise<CustomerDb> {
        // Validate input
        const validatedInput = updateCustomerSchema.parse(input);

        // Check if customer exists
        const exists = await this.repository.exists(companyId, id);
        if (!exists) {
            throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
        }

        const updated = await this.repository.update(companyId, id, validatedInput);

        if (!updated) {
            throw new AppError(500, "Failed to update customer", "UPDATE_FAILED");
        }

        return updated;
    }

    async deleteCustomer(
        companyId: string,
        id: string,
        userRole: UserRole
    ): Promise<void> {
        // Check if customer exists
        const exists = await this.repository.exists(companyId, id);
        if (!exists) {
            throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
        }

        if (userRole === "user") {
            // Soft delete: set status to inactive
            const updated = await this.repository.update(companyId, id, {
                status: "inactive",
            });

            if (!updated) {
                throw new AppError(500, "Failed to deactivate customer", "UPDATE_FAILED");
            }

            logger.info("Customer deactivated (soft delete)", { id, companyId, userRole });
        } else {
            // Hard delete: permanently remove from database with transaction
            const client = getClient();
            const session = client.startSession();

            try {
                await session.withTransaction(async () => {
                    // Delete customer
                    const deleted = await this.repository.delete(companyId, id, session);

                    if (!deleted) {
                        throw new AppError(500, "Failed to delete customer", "DELETE_FAILED");
                    }

                    // Delete associated images
                    const imageRepo = new CustomerImageRepository();
                    const deletedImagesCount = await imageRepo.deleteAllByCustomerId(companyId, id, session);

                    logger.info(`Deleted ${deletedImagesCount} images for customer ${id}`, { companyId });
                });

                logger.info("Customer and associated images permanently deleted (hard delete)", { id, companyId, userRole });
            } catch (error) {
                logger.error("Failed to delete customer with transaction", error);
                throw error;
            } finally {
                await session.endSession();
            }
        }
    }
}

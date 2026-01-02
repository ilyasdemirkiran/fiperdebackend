import { CustomerRepository } from "@/repositories/customer.repository";
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

        // Generate unique ID
        const id = crypto.randomUUID();

        const customer: CustomerDb = {
            id,
            ...validatedInput,
            status: validatedInput.status || "active",
            address: validatedInput.address || "",
            imageCount: 0,
            createdAt: new Date(),
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
            // Hard delete: permanently remove from database
            const deleted = await this.repository.delete(companyId, id);

            if (!deleted) {
                throw new AppError(500, "Failed to delete customer", "DELETE_FAILED");
            }

            logger.info("Customer permanently deleted (hard delete)", { id, companyId, userRole });
        }
    }
}

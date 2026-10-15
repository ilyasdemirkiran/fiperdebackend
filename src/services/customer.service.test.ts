import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CustomerService } from "./customer.service";
import { AppError } from "@/middleware/error-handler";
import type { CustomerRepository } from "@/repositories/customer.repository";
import type { DayScheduleRepository } from "@/repositories/day-schedule.repository";
import type { CustomerDb } from "@/types/customer/customer";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";
import * as dbConfig from "@/config/database";

describe("CustomerService Unit Tests", () => {
  let customerService: CustomerService;
  let mockCustomerRepo: Partial<CustomerRepository>;
  let mockScheduleRepo: Partial<DayScheduleRepository>;

  const companyId = "comp-1";
  const customerId = "cust-123";

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockCustomerRepo = {
      create: mock(),
      findById: mock(),
      findAll: mock(),
      getAll: mock(),
      exists: mock(),
      update: mock(),
      delete: mock(),
    };

    mockScheduleRepo = {
      getTasksByCustomerId: mock(),
    };

    customerService = new CustomerService(
      mockCustomerRepo as CustomerRepository,
      mockScheduleRepo as DayScheduleRepository
    );
  });

  describe("createCustomer", () => {
    it("should successfully create customer with default status and imageCount", async () => {
      const generatedId = new ObjectId();
      (mockCustomerRepo.create as any).mockImplementation((_cid: string, data: any) =>
        Promise.resolve({ ...data, _id: generatedId })
      );

      const result = await customerService.createCustomer(companyId, {
        name: "Ahmet",
        surname: "Kaya",
        phone: "+905551112233",
        city: "İstanbul",
        status: "active",
      });

      expect(mockCustomerRepo.create).toHaveBeenCalled();
      expect(result.name).toBe("Ahmet");
      expect(result.surname).toBe("Kaya");
      expect(result.status).toBe("active");
      expect(result.imageCount).toBe(0);
      expect(result._id).toEqual(generatedId);
    });

    it("should fail validation if name or surname is too short or missing", async () => {
      expect(
        customerService.createCustomer(companyId, {
          name: "A", // too short, min 2 chars
          surname: "B",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("getCustomer", () => {
    it("should return customer if found", async () => {
      const mockCustomer: CustomerDb = {
        _id: new ObjectId(),
        name: "Kemal",
        surname: "Sunal",
        status: "active",
        address: "",
        imageCount: 0,
        createdAt: Timestamp.now(),
      };
      (mockCustomerRepo.findById as any).mockResolvedValue(mockCustomer);

      const result = await customerService.getCustomer(companyId, customerId);

      expect(result).toEqual(mockCustomer);
      expect(mockCustomerRepo.findById).toHaveBeenCalledWith(companyId, customerId);
    });

    it("should throw AppError(404) if customer is not found", async () => {
      (mockCustomerRepo.findById as any).mockResolvedValue(null);

      expect(customerService.getCustomer(companyId, "missing-id")).rejects.toThrow(
        new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND")
      );
    });
  });

  describe("updateCustomer", () => {
    it("should throw AppError(404) if customer does not exist", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(
        customerService.updateCustomer(companyId, "missing", { name: "Yeni" })
      ).rejects.toThrow(new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND"));
    });

    it("should update customer successfully", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      const updatedCustomer: CustomerDb = {
        _id: new ObjectId(),
        name: "Yeni İsim",
        surname: "Soyisim",
        status: "active",
        address: "",
        imageCount: 0,
        createdAt: Timestamp.now(),
      };
      (mockCustomerRepo.update as any).mockResolvedValue(updatedCustomer);

      const result = await customerService.updateCustomer(companyId, customerId, {
        name: "Yeni İsim",
      });

      expect(mockCustomerRepo.update).toHaveBeenCalledWith(companyId, customerId, {
        name: "Yeni İsim",
      });
      expect(result.name).toBe("Yeni İsim");
    });

    it("should throw AppError(500) if update returns null", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockCustomerRepo.update as any).mockResolvedValue(null);

      expect(
        customerService.updateCustomer(companyId, customerId, { name: "İsim" })
      ).rejects.toThrow(new AppError(500, "Failed to update customer", "UPDATE_FAILED"));
    });
  });

  describe("deleteCustomer (Soft Delete vs Hard Delete)", () => {
    it("should perform soft delete (status: inactive) when user role is 'user'", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      (mockCustomerRepo.update as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "inactive",
      });

      await customerService.deleteCustomer(companyId, customerId, "user");

      expect(mockCustomerRepo.update).toHaveBeenCalledWith(companyId, customerId, {
        status: "inactive",
      });
      expect(mockCustomerRepo.delete).not.toHaveBeenCalled();
    });

    it("should perform hard delete with transaction when user role is 'admin' or 'sudo'", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);

      const mockSession = {
        withTransaction: async (fn: any) => await fn(),
        endSession: mock(),
      };
      spyOn(dbConfig, "getClient").mockReturnValue({
        startSession: () => mockSession,
      } as any);

      const { CustomerImageRepository } = await import("@/repositories/customer-image.repository");
      const { SaleRepository } = await import("@/repositories/sale.repository");
      const { CustomerNoteRepository } = await import("@/repositories/customer-note.repository");

      spyOn(CustomerImageRepository.prototype, "deleteAllByCustomerId").mockResolvedValue(2);
      spyOn(SaleRepository.prototype, "deleteByCustomerId").mockResolvedValue(1);
      spyOn(CustomerNoteRepository.prototype, "deleteAllByCustomerId").mockResolvedValue(3);

      (mockCustomerRepo.delete as any).mockResolvedValue(true);

      await customerService.deleteCustomer(companyId, customerId, "admin");

      expect(mockCustomerRepo.delete).toHaveBeenCalledWith(companyId, customerId, mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it("should throw AppError(404) if customer to delete does not exist", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(
        customerService.deleteCustomer(companyId, "missing", "admin")
      ).rejects.toThrow(new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND"));
    });
  });

  describe("getCustomerTasks", () => {
    it("should return tasks for customer when customer exists", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(true);
      const mockTasks = [{ id: "task-1", title: "Ölçü Alma" }];
      (mockScheduleRepo.getTasksByCustomerId as any).mockResolvedValue(mockTasks);

      const result = await customerService.getCustomerTasks(companyId, customerId);

      expect(result).toEqual(mockTasks as any);
      expect(mockScheduleRepo.getTasksByCustomerId).toHaveBeenCalledWith(companyId, customerId);
    });

    it("should throw AppError(404) if customer does not exist when fetching tasks", async () => {
      (mockCustomerRepo.exists as any).mockResolvedValue(false);

      expect(customerService.getCustomerTasks(companyId, "missing")).rejects.toThrow(
        new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND")
      );
    });
  });
});

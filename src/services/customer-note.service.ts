import {CustomerNoteRepository} from "@/repositories/customer-note.repository";
import {CustomerRepository} from "@/repositories/customer.repository";
import {createCustomerNoteSchema, type CustomerNoteDb, updateCustomerNoteSchema,} from "@/types/customer/customer_notes/customer_note";
import {AppError} from "@/middleware/error-handler";
import {ObjectId} from "mongodb";
import {Timestamp} from "firebase-admin/firestore";

export class CustomerNoteService {
  private repository: CustomerNoteRepository;
  private customerRepository: CustomerRepository;

  constructor() {
    this.repository = new CustomerNoteRepository();
    this.customerRepository = new CustomerRepository();
  }

  async createNote(
    companyId: string,
    userId: string,
    customerId: string,
    noteText: string
  ): Promise<CustomerNoteDb> {
    // Check if customer exists
    const customerExists = await this.customerRepository.exists(companyId, customerId);
    if (!customerExists) {
      throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
    }

    // Validate and parse input schema
    const validated = createCustomerNoteSchema.parse({
      customerId: new ObjectId(customerId),
      userId,
      note: noteText,
      createdAt: Timestamp.now(),
    });

    const note: CustomerNoteDb = {
      _id: new ObjectId(),
      ...validated,
    };

    return await this.repository.create(companyId, note);
  }

  async getNote(companyId: string, id: string): Promise<CustomerNoteDb> {
    const note = await this.repository.findById(companyId, id);
    if (!note) {
      throw new AppError(404, "Customer note not found", "CUSTOMER_NOTE_NOT_FOUND");
    }
    return note;
  }

  async listNotesByCustomer(companyId: string, customerId: string): Promise<CustomerNoteDb[]> {
    // Check if customer exists
    const customerExists = await this.customerRepository.exists(companyId, customerId);
    if (!customerExists) {
      throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
    }

    return await this.repository.findByCustomerId(companyId, customerId);
  }

  async updateNote(
    companyId: string,
    id: string,
    noteText: string
  ): Promise<CustomerNoteDb> {
    // Check if note exists
    const exists = await this.repository.findById(companyId, id);
    if (!exists) {
      throw new AppError(404, "Customer note not found", "CUSTOMER_NOTE_NOT_FOUND");
    }

    // Validate update input
    const validated = updateCustomerNoteSchema.parse({
      note: noteText,
    });

    const updated = await this.repository.update(companyId, id, {
      ...validated,
      updatedAt: Timestamp.now(),
    });

    if (!updated) {
      throw new AppError(500, "Failed to update customer note", "UPDATE_FAILED");
    }

    return updated;
  }

  async deleteNote(companyId: string, id: string): Promise<void> {
    // Check if note exists
    const exists = await this.repository.findById(companyId, id);
    if (!exists) {
      throw new AppError(404, "Customer note not found", "CUSTOMER_NOTE_NOT_FOUND");
    }

    const deleted = await this.repository.delete(companyId, id);
    if (!deleted) {
      throw new AppError(500, "Failed to delete customer note", "DELETE_FAILED");
    }
  }
}

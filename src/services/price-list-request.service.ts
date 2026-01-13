import { PriceListRequestRepository } from "@/repositories/price-list-request.repository";
import type { PriceListRequest, PriceListRequestMetadata } from "@/types/vendor/price_list_request";
import { PRICE_LIST_ALLOWED_MIME_TYPES } from "@/types/vendor/price_list_request";
import { AppError } from "@/middleware/error-handler";
import { logger } from "@/utils/logger";
import type { UserRole, FIUser } from "@/types/user/fi_user";
import { isAdmin } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import { Binary } from "mongodb";

export interface SubmitPriceListRequestInput {
  vendorName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}

export class PriceListRequestService {
  private repository: PriceListRequestRepository;

  constructor() {
    this.repository = new PriceListRequestRepository();
  }

  private assertSudo(role: UserRole): void {
    if (role !== "sudo") {
      throw new AppError(403, "Only sudo users can perform this operation", "FORBIDDEN");
    }
  }

  private assertAdminOrAbove(role: UserRole): void {
    if (!isAdmin(role)) {
      throw new AppError(403, "Only admin users can perform this operation", "FORBIDDEN");
    }
  }

  /**
   * Submit a price list request (admin users)
   */
  async submitRequest(
    user: FIUser,
    companyName: string,
    input: SubmitPriceListRequestInput
  ): Promise<PriceListRequestMetadata> {
    this.assertAdminOrAbove(user.role);

    // Validate mime type
    if (!PRICE_LIST_ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
      throw new AppError(400, "Invalid file type. Only PDF and Excel files are allowed.", "INVALID_FILE_TYPE");
    }

    const request: Omit<PriceListRequest, "_id"> = {
      vendorName: input.vendorName,
      status: "pending",
      filename: input.filename,
      mimeType: input.mimeType as any,
      size: input.data.length,
      data: new Binary(input.data),
      requestedBy: {
        userId: user._id?.toString() || "",
        name: user.name,
        phone: user.phoneNumber as string,
        companyId: user.companyId,
        companyName: companyName,
      },
      requestedAt: Timestamp.now(),
    };

    const created = await this.repository.create(request);

    // Return metadata without binary data
    const { data, ...metadata } = created;
    return metadata;
  }

  /**
   * List all price list requests (sudo only)
   */
  async listAllRequests(role: UserRole): Promise<PriceListRequestMetadata[]> {
    this.assertSudo(role);
    return await this.repository.findAll();
  }

  /**
   * List price list requests by status (sudo only)
   */
  async listRequestsByStatus(role: UserRole, status: 'pending' | 'completed'): Promise<PriceListRequestMetadata[]> {
    this.assertSudo(role);
    return await this.repository.findByStatus(status);
  }

  /**
   * List price list requests for a company (admin of that company or sudo)
   */
  async listRequestsForCompany(user: FIUser): Promise<PriceListRequestMetadata[]> {
    if (user.role === "sudo") {
      return await this.repository.findAll();
    }

    this.assertAdminOrAbove(user.role);
    return await this.repository.findByCompanyId(user.companyId!);
  }

  /**
   * Complete a price list request (sudo only)
   */
  async completeRequest(
    role: UserRole,
    requestId: string,
    completedByUser: { userId: string; name: string }
  ): Promise<PriceListRequestMetadata> {
    this.assertSudo(role);

    const existing = await this.repository.findById(requestId);
    if (!existing) {
      throw new AppError(404, "Price list request not found", "REQUEST_NOT_FOUND");
    }

    if (existing.status === "completed") {
      throw new AppError(400, "Request is already completed", "ALREADY_COMPLETED");
    }

    const updated = await this.repository.complete(
      requestId,
      completedByUser,
      Timestamp.now()
    );

    if (!updated) {
      throw new AppError(500, "Failed to complete request", "UPDATE_FAILED");
    }

    logger.info("Price list request completed", { requestId, completedBy: completedByUser.name });

    const { data, ...metadata } = updated;
    return metadata;
  }

  /**
   * Get request file for download
   */
  async getRequestFile(role: UserRole, requestId: string): Promise<{ metadata: PriceListRequestMetadata; buffer: Buffer }> {
    this.assertSudo(role);

    const request = await this.repository.findById(requestId);
    if (!request) {
      throw new AppError(404, "Price list request not found", "REQUEST_NOT_FOUND");
    }

    const { data, ...metadata } = request;
    return {
      metadata,
      buffer: Buffer.from(data.buffer),
    };
  }

  /**
   * Delete a price list request (sudo only)
   */
  async deleteRequest(role: UserRole, requestId: string): Promise<void> {
    this.assertSudo(role);

    const deleted = await this.repository.delete(requestId);
    if (!deleted) {
      throw new AppError(404, "Price list request not found", "REQUEST_NOT_FOUND");
    }

    logger.info("Price list request deleted", { requestId });
  }
}

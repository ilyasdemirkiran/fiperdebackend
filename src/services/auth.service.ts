import { UserRepository } from "@/repositories/user.repository";
import { verifyFirebaseToken } from "@/config/firebase";
import { AppError } from "@/middleware/error-handler";
import type { FIUser } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async registerUser(token: string, data: { name: string; surname: string }): Promise<FIUser> {
    const decoded = await verifyFirebaseToken(token);
    const { uid, phone_number } = decoded;

    if (!phone_number) {
      throw new AppError(400, "Phone number required in token", "INVALID_TOKEN");
    }

    const existing = await this.userRepo.findById(uid);
    if (existing) {
      logger.info("User already exists, returning existing user", { uid });
      return existing;
    }

    // Check if phone number is already in use by another user
    const existingByPhone = await this.userRepo.findByPhoneNumber(phone_number);
    if (existingByPhone) {
      throw new AppError(409, "Bu telefon numarası zaten kayıtlı", "PHONE_NUMBER_ALREADY_EXISTS");
    }

    const newUser: FIUser = {
      _id: uid,
      phoneNumber: phone_number,
      name: data.name,
      surname: data.surname,
      role: "user",
      createdAt: Timestamp.now(),
    };

    const created = await this.userRepo.create(newUser);
    logger.info("Registered new user", { uid });
    return created;
  }

  async isNumberRegistered(phoneNumber: string): Promise<{ registered: boolean; hasCompany: boolean }> {
    const user = await this.userRepo.findByPhoneNumber(phoneNumber);

    if (!user) {
      return { registered: false, hasCompany: false };
    }

    return { registered: true, hasCompany: !!user.companyId };
  }

  async getUserById(userId: string): Promise<FIUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return user;
  }

  async updateProfile(userId: string, data: { name: string; surname: string }): Promise<FIUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const updated = await this.userRepo.update(userId, {
      name: data.name,
      surname: data.surname,
    });

    if (!updated) {
      throw new AppError(500, "Failed to update profile");
    }

    return updated;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.companyId) {
      // Check if user is the company owner
      const { CompanyRepository } = await import("@/repositories/company.repository");
      const companyRepo = new CompanyRepository();
      const company = await companyRepo.findById(user.companyId);

      if (company && company.creatorUserId === userId) {
        // Owner deleting account -> Delete entire company first
        const { CompanyService } = await import("./company.service");
        const companyService = new CompanyService();
        await companyService.deleteCompany(userId);
      } else {
        // Regular member -> Remove from company
        const { CompanyRepository } = await import("@/repositories/company.repository");
        const companyRepo = new CompanyRepository(); // Instantiate again or reuse if refactored
        await companyRepo.removeUser(user.companyId, userId);
      }
    }

    // Finally delete the user account
    await this.userRepo.delete(userId);

    // Also delete from Firebase Auth (optional, but good practice if you have the SDK setup for it)
    try {
      const { getAuth } = await import("firebase-admin/auth");
      await getAuth().deleteUser(userId);
      logger.info("Deleted user from Firebase Auth", { uid: userId });
    } catch (error) {
      logger.error("Failed to delete user from Firebase Auth", error);
      // Continue even if Firebase deletion fails
    }

    logger.info("Account deleted", { userId });
  }
}

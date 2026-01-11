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
}

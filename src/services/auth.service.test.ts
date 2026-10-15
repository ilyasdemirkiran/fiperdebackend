import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { AuthService } from "./auth.service";
import { AppError } from "@/middleware/error-handler";
import type { UserRepository } from "@/repositories/user.repository";
import type { FIUser } from "@/types/user/fi_user";
import { Timestamp } from "firebase-admin/firestore";
import * as firebaseConfig from "@/config/firebase";
import * as firebaseAdminAuth from "firebase-admin/auth";
import { CompanyRepository } from "@/repositories/company.repository";
import { CompanyService } from "./company.service";
import { logger } from "@/utils/logger";

describe("AuthService Unit Tests", () => {
  let authService: AuthService;
  let mockUserRepo: Partial<UserRepository>;
  let verifyFirebaseTokenSpy: any;
  let getAuthSpy: any;
  let mockDeleteUser: any;
  let companyRepoFindByIdSpy: any;
  let companyRepoRemoveUserSpy: any;
  let companyServiceDeleteCompanySpy: any;

  beforeEach(() => {
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockDeleteUser = mock();
    verifyFirebaseTokenSpy = spyOn(firebaseConfig, "verifyFirebaseToken");
    getAuthSpy = spyOn(firebaseAdminAuth, "getAuth").mockReturnValue({
      deleteUser: mockDeleteUser,
    } as any);

    companyRepoFindByIdSpy = spyOn(CompanyRepository.prototype, "findById");
    companyRepoRemoveUserSpy = spyOn(CompanyRepository.prototype, "removeUser");
    companyServiceDeleteCompanySpy = spyOn(CompanyService.prototype, "deleteCompany");

    mockUserRepo = {
      create: mock(),
      findById: mock(),
      findByPhoneNumber: mock(),
      update: mock(),
      delete: mock(),
    };

    authService = new AuthService(mockUserRepo as UserRepository);
  });

  afterEach(() => {
    verifyFirebaseTokenSpy?.mockRestore?.();
    getAuthSpy?.mockRestore?.();
    companyRepoFindByIdSpy?.mockRestore?.();
    companyRepoRemoveUserSpy?.mockRestore?.();
    companyServiceDeleteCompanySpy?.mockRestore?.();
  });

  describe("registerUser", () => {
    const validData = { name: "Ahmet", surname: "Yılmaz" };

    it("should successfully register a new user when token is valid and user does not exist", async () => {
      verifyFirebaseTokenSpy.mockResolvedValue({
        uid: "user-123",
        phone_number: "+905551112233",
      });
      (mockUserRepo.findById as any).mockResolvedValue(null);
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue(null);
      (mockUserRepo.create as any).mockImplementation((u: FIUser) => Promise.resolve(u));

      const result = await authService.registerUser("valid-token", validData);

      expect(verifyFirebaseTokenSpy).toHaveBeenCalledWith("valid-token");
      expect(mockUserRepo.findById).toHaveBeenCalledWith("user-123");
      expect(mockUserRepo.findByPhoneNumber).toHaveBeenCalledWith("+905551112233");
      expect(mockUserRepo.create).toHaveBeenCalled();

      expect(result._id).toBe("user-123");
      expect(result.phoneNumber).toBe("+905551112233");
      expect(result.name).toBe("Ahmet");
      expect(result.surname).toBe("Yılmaz");
      expect(result.role).toBe("user");
      expect(result.createdAt).toBeDefined();
    });

    it("should return existing user without creating new one if user ID already exists (idempotency)", async () => {
      const existingUser: FIUser = {
        _id: "user-123",
        phoneNumber: "+905551112233",
        name: "Eski",
        surname: "Kullanici",
        role: "user",
        createdAt: Timestamp.now(),
      };

      verifyFirebaseTokenSpy.mockResolvedValue({
        uid: "user-123",
        phone_number: "+905551112233",
      });
      (mockUserRepo.findById as any).mockResolvedValue(existingUser);

      const result = await authService.registerUser("valid-token", validData);

      expect(result).toEqual(existingUser);
      expect(mockUserRepo.create).not.toHaveBeenCalled();
      expect(mockUserRepo.findByPhoneNumber).not.toHaveBeenCalled();
    });

    it("should throw AppError(400) if token does not contain a phone_number", async () => {
      verifyFirebaseTokenSpy.mockResolvedValue({
        uid: "user-no-phone",
        // phone_number missing
      });

      expect(authService.registerUser("token-without-phone", validData)).rejects.toThrow(
        new AppError(400, "Phone number required in token", "INVALID_TOKEN")
      );
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it("should throw AppError(409) if phone number is already registered to a different user ID", async () => {
      verifyFirebaseTokenSpy.mockResolvedValue({
        uid: "new-user-id",
        phone_number: "+905551112233",
      });
      (mockUserRepo.findById as any).mockResolvedValue(null);
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue({
        _id: "another-user-id",
        phoneNumber: "+905551112233",
      } as FIUser);

      expect(authService.registerUser("token", validData)).rejects.toThrow(
        new AppError(409, "Bu telefon numarası zaten kayıtlı", "PHONE_NUMBER_ALREADY_EXISTS")
      );
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it("should propagate error if token verification fails", async () => {
      verifyFirebaseTokenSpy.mockRejectedValue(new Error("Invalid authentication token"));

      expect(authService.registerUser("invalid-token", validData)).rejects.toThrow(
        "Invalid authentication token"
      );
    });
  });

  describe("isNumberRegistered", () => {
    it("should return { registered: false, hasCompany: false } when phone number is not found", async () => {
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue(null);

      const result = await authService.isNumberRegistered("+905550000000");

      expect(result).toEqual({ registered: false, hasCompany: false });
      expect(mockUserRepo.findByPhoneNumber).toHaveBeenCalledWith("+905550000000");
    });

    it("should return { registered: true, hasCompany: false } when user exists but has no companyId", async () => {
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue({
        _id: "user-1",
        phoneNumber: "+905551112233",
      } as FIUser);

      const result = await authService.isNumberRegistered("+905551112233");

      expect(result).toEqual({ registered: true, hasCompany: false });
    });

    it("should return { registered: true, hasCompany: true } when user exists and has companyId", async () => {
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue({
        _id: "user-1",
        phoneNumber: "+905551112233",
        companyId: "company-999",
      } as FIUser);

      const result = await authService.isNumberRegistered("+905551112233");

      expect(result).toEqual({ registered: true, hasCompany: true });
    });
  });

  describe("getUserById", () => {
    it("should return user when user exists", async () => {
      const mockUser: FIUser = {
        _id: "user-123",
        phoneNumber: "+905551112233",
        name: "Mehmet",
        surname: "Kaya",
        role: "admin",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(mockUser);

      const result = await authService.getUserById("user-123");

      expect(result).toEqual(mockUser);
      expect(mockUserRepo.findById).toHaveBeenCalledWith("user-123");
    });

    it("should throw AppError(404) when user is not found", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      expect(authService.getUserById("non-existent-user")).rejects.toThrow(
        new AppError(404, "User not found")
      );
    });
  });

  describe("updateProfile", () => {
    it("should successfully update user profile and return updated user", async () => {
      const existingUser: FIUser = {
        _id: "user-123",
        phoneNumber: "+905551112233",
        name: "Eski",
        surname: "Ad",
        role: "user",
        createdAt: Timestamp.now(),
      };
      const updatedUser: FIUser = {
        ...existingUser,
        name: "Yeni",
        surname: "Soyad",
      };

      (mockUserRepo.findById as any).mockResolvedValue(existingUser);
      (mockUserRepo.update as any).mockResolvedValue(updatedUser);

      const result = await authService.updateProfile("user-123", {
        name: "Yeni",
        surname: "Soyad",
      });

      expect(mockUserRepo.findById).toHaveBeenCalledWith("user-123");
      expect(mockUserRepo.update).toHaveBeenCalledWith("user-123", {
        name: "Yeni",
        surname: "Soyad",
      });
      expect(result).toEqual(updatedUser);
    });

    it("should throw AppError(404) if user does not exist", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      expect(
        authService.updateProfile("missing-user", { name: "A", surname: "B" })
      ).rejects.toThrow(new AppError(404, "User not found"));
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it("should throw AppError(500) if repository update fails to return updated document", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({ _id: "user-123" });
      (mockUserRepo.update as any).mockResolvedValue(null);

      expect(
        authService.updateProfile("user-123", { name: "A", surname: "B" })
      ).rejects.toThrow(new AppError(500, "Failed to update profile"));
    });
  });

  describe("deleteAccount", () => {
    it("should throw AppError(404) if user does not exist", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      expect(authService.deleteAccount("non-existing-user")).rejects.toThrow(
        new AppError(404, "User not found")
      );
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it("should delete independent user (without companyId) and remove from Firebase Auth", async () => {
      const userWithoutCompany: FIUser = {
        _id: "user-solo",
        phoneNumber: "+905551112233",
        name: "Solo",
        surname: "User",
        role: "user",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(userWithoutCompany);
      (mockUserRepo.delete as any).mockResolvedValue(true);
      mockDeleteUser.mockResolvedValue(undefined);

      await authService.deleteAccount("user-solo");

      expect(companyServiceDeleteCompanySpy).not.toHaveBeenCalled();
      expect(companyRepoRemoveUserSpy).not.toHaveBeenCalled();
      expect(mockUserRepo.delete).toHaveBeenCalledWith("user-solo");
      expect(mockDeleteUser).toHaveBeenCalledWith("user-solo");
    });

    it("should delete company first if user is the company owner (creatorUserId)", async () => {
      const ownerUser: FIUser = {
        _id: "owner-id",
        phoneNumber: "+905551112233",
        name: "Owner",
        surname: "User",
        role: "admin",
        companyId: "company-100",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(ownerUser);
      companyRepoFindByIdSpy.mockResolvedValue({
        _id: "company-100",
        name: "Test Perde Ltd",
        creatorUserId: "owner-id",
      });
      companyServiceDeleteCompanySpy.mockResolvedValue(undefined);
      (mockUserRepo.delete as any).mockResolvedValue(true);
      mockDeleteUser.mockResolvedValue(undefined);

      await authService.deleteAccount("owner-id");

      expect(companyRepoFindByIdSpy).toHaveBeenCalledWith("company-100");
      expect(companyServiceDeleteCompanySpy).toHaveBeenCalledWith("owner-id");
      expect(companyRepoRemoveUserSpy).not.toHaveBeenCalled();
      expect(mockUserRepo.delete).toHaveBeenCalledWith("owner-id");
      expect(mockDeleteUser).toHaveBeenCalledWith("owner-id");
    });

    it("should only remove user from company if user is a regular member (not creatorUserId)", async () => {
      const memberUser: FIUser = {
        _id: "member-id",
        phoneNumber: "+905551112233",
        name: "Member",
        surname: "User",
        role: "user",
        companyId: "company-100",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(memberUser);
      companyRepoFindByIdSpy.mockResolvedValue({
        _id: "company-100",
        name: "Test Perde Ltd",
        creatorUserId: "someone-else-owner",
      });
      companyRepoRemoveUserSpy.mockResolvedValue(true);
      (mockUserRepo.delete as any).mockResolvedValue(true);
      mockDeleteUser.mockResolvedValue(undefined);

      await authService.deleteAccount("member-id");

      expect(companyRepoFindByIdSpy).toHaveBeenCalledWith("company-100");
      expect(companyRepoRemoveUserSpy).toHaveBeenCalledWith("company-100", "member-id");
      expect(companyServiceDeleteCompanySpy).not.toHaveBeenCalled();
      expect(mockUserRepo.delete).toHaveBeenCalledWith("member-id");
      expect(mockDeleteUser).toHaveBeenCalledWith("member-id");
    });

    it("should continue deletion gracefully even if Firebase Auth deletion fails", async () => {
      const memberUser: FIUser = {
        _id: "member-id",
        phoneNumber: "+905551112233",
        name: "Member",
        surname: "User",
        role: "user",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(memberUser);
      (mockUserRepo.delete as any).mockResolvedValue(true);
      mockDeleteUser.mockRejectedValue(new Error("Firebase network error"));

      // Should not throw
      await expect(authService.deleteAccount("member-id")).resolves.toBeUndefined();

      expect(mockUserRepo.delete).toHaveBeenCalledWith("member-id");
      expect(mockDeleteUser).toHaveBeenCalledWith("member-id");
    });
  });
});

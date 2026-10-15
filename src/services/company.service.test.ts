import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CompanyService } from "./company.service";
import { AppError } from "@/middleware/error-handler";
import type { CompanyRepository } from "@/repositories/company.repository";
import type { CompanyInviteRepository } from "@/repositories/company-invite.repository";
import type { UserRepository } from "@/repositories/user.repository";
import type { Company } from "@/types/company/company";
import type { CompanyInvite } from "@/types/company/company_invite";
import type { FIUser } from "@/types/user/fi_user";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/utils/logger";

// Mock database functions used by CompanyService
const mockCopyTenantDatabase = mock();
const mockDropCompanyDatabase = mock();
mock.module("@/config/database", () => ({
  copyTenantDatabase: mockCopyTenantDatabase,
  dropCompanyDatabase: mockDropCompanyDatabase,
}));

describe("CompanyService Unit Tests", () => {
  let companyService: CompanyService;
  let mockCompanyRepo: Partial<CompanyRepository>;
  let mockInviteRepo: Partial<CompanyInviteRepository>;
  let mockUserRepo: Partial<UserRepository>;

  beforeEach(() => {
    // Silence console logging during test runs
    mockCopyTenantDatabase.mockReset();
    mockDropCompanyDatabase.mockReset();
    spyOn(logger, "info").mockImplementation(() => {});
    spyOn(logger, "error").mockImplementation(() => {});
    spyOn(logger, "warn").mockImplementation(() => {});

    mockCompanyRepo = {
      create: mock(),
      findById: mock(),
      findByIds: mock(),
      findDemoCompany: mock(),
      update: mock(),
      delete: mock(),
      addUser: mock(),
      removeUser: mock(),
      uploadLogoToGridFS: mock(),
      deleteLogoFromGridFS: mock(),
      downloadLogoFromGridFS: mock(),
    };

    mockInviteRepo = {
      create: mock(),
      findById: mock(),
      findByCompanyId: mock(),
      findPendingByPhone: mock(),
      findPendingByPhoneAndCompany: mock(),
      updateStatus: mock(),
      delete: mock(),
    };

    mockUserRepo = {
      findById: mock(),
      findByPhoneNumber: mock(),
      findByCompanyId: mock(),
      update: mock(),
    };

    companyService = new CompanyService(
      mockCompanyRepo as CompanyRepository,
      mockInviteRepo as CompanyInviteRepository,
      mockUserRepo as UserRepository
    );
  });

  describe("createCompany", () => {
    it("should create company, make creator admin, and copy demo database if available", async () => {
      const user: FIUser = {
        _id: "user-1",
        phoneNumber: "+905551112233",
        name: "Ali",
        surname: "Veli",
        role: "user",
        createdAt: Timestamp.now(),
      };
      (mockUserRepo.findById as any).mockResolvedValue(user);

      const generatedId = new ObjectId();
      const createdCompany: Company = {
        _id: generatedId,
        name: "Test Perde",
        creatorUserId: "user-1",
        userIds: ["user-1"],
        registrationAgreement: true,
        createdAt: Timestamp.now(),
        isDemo: false,
      };
      (mockCompanyRepo.create as any).mockResolvedValue(createdCompany);
      (mockUserRepo.update as any).mockResolvedValue(user);

      const demoCompanyId = new ObjectId();
      (mockCompanyRepo.findDemoCompany as any).mockResolvedValue({
        _id: demoCompanyId,
        name: "Demo Co",
        isDemo: true,
      });
      mockCopyTenantDatabase.mockResolvedValue(undefined);

      const result = await companyService.createCompany("user-1", "Test Perde");

      expect(mockCompanyRepo.create).toHaveBeenCalled();
      expect(mockUserRepo.update).toHaveBeenCalledWith("user-1", {
        companyId: generatedId.toHexString(),
        role: "admin",
      });
      expect(mockCopyTenantDatabase).toHaveBeenCalledWith(
        demoCompanyId.toHexString(),
        generatedId.toHexString()
      );
      expect(result).toEqual(createdCompany);
    });

    it("should throw AppError(404) if user does not exist", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      expect(companyService.createCompany("missing-user", "Co")).rejects.toThrow(
        new AppError(404, "User not found")
      );
      expect(mockCompanyRepo.create).not.toHaveBeenCalled();
    });

    it("should throw AppError(400) if user already belongs to a company", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "user-1",
        companyId: "existing-company-id",
      });

      expect(companyService.createCompany("user-1", "Co")).rejects.toThrow(
        new AppError(400, "User already has a company")
      );
      expect(mockCompanyRepo.create).not.toHaveBeenCalled();
    });

    it("should succeed even if demo database copying fails", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "user-1",
      });
      const generatedId = new ObjectId();
      (mockCompanyRepo.create as any).mockResolvedValue({
        _id: generatedId,
        name: "Test Co",
      });
      (mockCompanyRepo.findDemoCompany as any).mockResolvedValue({
        _id: new ObjectId(),
      });
      mockCopyTenantDatabase.mockRejectedValue(new Error("Mongo connection timeout"));

      const result = await companyService.createCompany("user-1", "Test Co");
      expect(result._id).toEqual(generatedId);
    });
  });

  describe("inviteUser", () => {
    const validInviter: FIUser = {
      _id: "admin-1",
      phoneNumber: "+905551111111",
      name: "Admin",
      surname: "One",
      role: "admin",
      companyId: "comp-1",
      createdAt: Timestamp.now(),
    };

    it("should throw AppError(404) if inviter is not found", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      expect(companyService.inviteUser("missing", "comp-1", "+905552222222")).rejects.toThrow(
        new AppError(404, "Inviter not found")
      );
    });

    it("should throw AppError(403) if inviter is from a different company", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...validInviter,
        companyId: "other-comp",
      });

      expect(companyService.inviteUser("admin-1", "comp-1", "+905552222222")).rejects.toThrow(
        new AppError(403, "Not authorized to invite for this company")
      );
    });

    it("should throw AppError(403) if inviter has regular 'user' role", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...validInviter,
        role: "user",
      });

      expect(companyService.inviteUser("admin-1", "comp-1", "+905552222222")).rejects.toThrow(
        new AppError(403, "User role cannot invite")
      );
    });

    it("should throw AppError(400) if phone already has a pending invite for this company", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(validInviter);
      (mockInviteRepo.findPendingByPhoneAndCompany as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "pending",
      });

      expect(companyService.inviteUser("admin-1", "comp-1", "+905552222222")).rejects.toThrow(
        new AppError(400, "User already invited")
      );
    });

    it("should throw AppError(400) if invited user already belongs to a company", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(validInviter);
      (mockInviteRepo.findPendingByPhoneAndCompany as any).mockResolvedValue(null);
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue({
        _id: "target-user",
        companyId: "another-company",
      });

      expect(companyService.inviteUser("admin-1", "comp-1", "+905552222222")).rejects.toThrow(
        new AppError(400, "User is already in a company")
      );
    });

    it("should create pending invite successfully when phone exists in system without company", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(validInviter);
      (mockInviteRepo.findPendingByPhoneAndCompany as any).mockResolvedValue(null);
      (mockUserRepo.findByPhoneNumber as any).mockResolvedValue({
        _id: "target-user-without-comp",
        phoneNumber: "+905552222222",
      });

      const mockInvite: CompanyInvite = {
        _id: new ObjectId(),
        companyId: "comp-1",
        inviterUserId: "admin-1",
        invitedUserId: "target-user-without-comp",
        invitedPhoneNumber: "+905552222222",
        status: "pending",
        createdAt: Timestamp.now(),
      };
      (mockInviteRepo.create as any).mockResolvedValue(mockInvite);

      const result = await companyService.inviteUser("admin-1", "comp-1", "+905552222222");

      expect(mockInviteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "comp-1",
          inviterUserId: "admin-1",
          invitedUserId: "target-user-without-comp",
          invitedPhoneNumber: "+905552222222",
          status: "pending",
        })
      );
      expect(result).toEqual(mockInvite);
    });
  });

  describe("respondToInvite", () => {
    it("should throw AppError(404) if invite is not found", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue(null);

      expect(companyService.respondToInvite("user-1", "invite-1", true)).rejects.toThrow(
        new AppError(404, "Invite not found")
      );
    });

    it("should throw AppError(400) if invite status is not pending", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "accepted",
      });

      expect(companyService.respondToInvite("user-1", "invite-1", true)).rejects.toThrow(
        new AppError(400, "Invite no longer pending")
      );
    });

    it("should throw AppError(403) if invite belongs to a different userId", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "pending",
        invitedUserId: "different-user",
      });

      expect(companyService.respondToInvite("user-1", "invite-1", true)).rejects.toThrow(
        new AppError(403, "Invite does not belong to you")
      );
    });

    it("should reject invite properly when accept = false", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "pending",
        invitedUserId: "user-1",
      });

      await companyService.respondToInvite("user-1", "invite-1", false);

      expect(mockInviteRepo.updateStatus).toHaveBeenCalledWith("invite-1", "rejected");
      expect(mockCompanyRepo.addUser).not.toHaveBeenCalled();
    });

    it("should accept invite, add user to company, and update user record", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "pending",
        invitedUserId: "user-1",
        companyId: "comp-100",
      });
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "user-1",
        companyId: undefined,
      });

      await companyService.respondToInvite("user-1", "invite-1", true);

      expect(mockInviteRepo.updateStatus).toHaveBeenCalledWith("invite-1", "accepted");
      expect(mockCompanyRepo.addUser).toHaveBeenCalledWith("comp-100", "user-1");
      expect(mockUserRepo.update).toHaveBeenCalledWith("user-1", {
        companyId: "comp-100",
        role: "user",
      });
    });

    it("should throw AppError(400) if user trying to accept is already in another company", async () => {
      (mockInviteRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        status: "pending",
        invitedUserId: "user-1",
        companyId: "comp-100",
      });
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "user-1",
        companyId: "already-in-a-company",
      });

      expect(companyService.respondToInvite("user-1", "invite-1", true)).rejects.toThrow(
        new AppError(400, "You are already in a company")
      );
    });
  });

  describe("promoteUser / demoteUser / removeUserFromCompany", () => {
    const requesterAdmin: FIUser = {
      _id: "admin-1",
      companyId: "comp-1",
      role: "admin",
    } as FIUser;

    const companyDoc: Company = {
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      creatorUserId: "owner-id",
      name: "Comp 1",
    } as any;

    it("should throw AppError(403) when requester is not an admin", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...requesterAdmin,
        role: "user",
      });

      expect(companyService.promoteUser("admin-1", "comp-1", "target-id")).rejects.toThrow(
        new AppError(403, "Not authorized to promote users")
      );
    });

    it("should throw AppError(400) when trying to demote or promote company owner", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(requesterAdmin);
      (mockCompanyRepo.findById as any).mockResolvedValue(companyDoc);

      expect(companyService.promoteUser("admin-1", "comp-1", "owner-id")).rejects.toThrow(
        new AppError(400, "Cannot change role of company owner")
      );

      expect(companyService.demoteUser("admin-1", "comp-1", "owner-id")).rejects.toThrow(
        new AppError(400, "Cannot change role of company owner")
      );
    });

    it("should throw AppError(400) when trying to remove company owner", async () => {
      (mockUserRepo.findById as any).mockResolvedValue(requesterAdmin);
      (mockCompanyRepo.findById as any).mockResolvedValue(companyDoc);

      expect(
        companyService.removeUserFromCompany("admin-1", "comp-1", "owner-id")
      ).rejects.toThrow(new AppError(400, "Cannot remove company owner"));
    });

    it("should successfully promote member to admin", async () => {
      (mockUserRepo.findById as any).mockImplementation((id: string) => {
        if (id === "admin-1") return Promise.resolve(requesterAdmin);
        if (id === "target-id")
          return Promise.resolve({ _id: "target-id", companyId: "comp-1", role: "user" });
        return Promise.resolve(null);
      });
      (mockCompanyRepo.findById as any).mockResolvedValue(companyDoc);

      await companyService.promoteUser("admin-1", "comp-1", "target-id");

      expect(mockUserRepo.update).toHaveBeenCalledWith("target-id", { role: "admin" });
    });

    it("should successfully remove user from company and reset their companyId & role", async () => {
      (mockUserRepo.findById as any).mockImplementation((id: string) => {
        if (id === "admin-1") return Promise.resolve(requesterAdmin);
        if (id === "target-id")
          return Promise.resolve({ _id: "target-id", companyId: "comp-1", role: "user" });
        return Promise.resolve(null);
      });
      (mockCompanyRepo.findById as any).mockResolvedValue(companyDoc);

      await companyService.removeUserFromCompany("admin-1", "comp-1", "target-id");

      expect(mockCompanyRepo.removeUser).toHaveBeenCalledWith("comp-1", "target-id");
      expect(mockUserRepo.update).toHaveBeenCalledWith("target-id", {
        companyId: undefined,
        role: "user",
      });
    });
  });

  describe("leaveCompany", () => {
    it("should throw AppError(400) if user is the company owner", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "owner-id",
        companyId: "comp-1",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "owner-id",
      });

      expect(companyService.leaveCompany("owner-id")).rejects.toThrow(
        new AppError(400, "Company owner cannot leave the company")
      );
    });

    it("should remove user from company if user is a normal member", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "member-id",
        companyId: "comp-1",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "other-owner",
      });

      await companyService.leaveCompany("member-id");

      expect(mockCompanyRepo.removeUser).toHaveBeenCalledWith("comp-1", "member-id");
      expect(mockUserRepo.update).toHaveBeenCalledWith("member-id", {
        companyId: undefined,
        role: "user",
      });
    });
  });

  describe("deleteCompany", () => {
    it("should throw AppError(403) if requester is not the company owner", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "admin-not-owner",
        companyId: "comp-1",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "real-owner",
      });

      expect(companyService.deleteCompany("admin-not-owner")).rejects.toThrow(
        new AppError(403, "Only the company owner can delete the company")
      );
      expect(mockDropCompanyDatabase).not.toHaveBeenCalled();
    });

    it("should reset all company members, drop tenant DB, and delete company doc when owner deletes", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "owner-id",
        companyId: "comp-1",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "owner-id",
      });
      (mockUserRepo.findByCompanyId as any).mockResolvedValue([
        { _id: "owner-id" },
        { _id: "member-1" },
      ]);

      await companyService.deleteCompany("owner-id");

      expect(mockUserRepo.update).toHaveBeenCalledWith("owner-id", {
        companyId: undefined,
        role: "user",
      });
      expect(mockUserRepo.update).toHaveBeenCalledWith("member-1", {
        companyId: undefined,
        role: "user",
      });
      expect(mockDropCompanyDatabase).toHaveBeenCalledWith("comp-1");
      expect(mockCompanyRepo.delete).toHaveBeenCalledWith("comp-1");
    });
  });

  describe("Logo Management (uploadCompanyLogo, deleteCompanyLogo, getCompanyLogo)", () => {
    it("should throw AppError(403) if user is neither admin nor owner when uploading logo", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "user-regular",
        companyId: "comp-1",
        role: "user",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "different-owner",
      });

      expect(
        companyService.uploadCompanyLogo("user-regular", "comp-1", {})
      ).rejects.toThrow(new AppError(403, "Only admin or company owner can manage logo"));
    });

    it("should delete existing logo files from GridFS and upload new ones", async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        _id: "admin-1",
        companyId: "comp-1",
        role: "admin",
      });
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        creatorUserId: "admin-1",
        logoOriginalFileId: "old-orig-id",
        logoMiniFileId: "old-mini-id",
      });
      (mockCompanyRepo.uploadLogoToGridFS as any)
        .mockResolvedValueOnce("new-orig-id")
        .mockResolvedValueOnce("new-mini-id");
      (mockCompanyRepo.update as any).mockResolvedValue({
        _id: new ObjectId(),
        logoOriginalFileId: "new-orig-id",
        logoMiniFileId: "new-mini-id",
      });

      const buffer = Buffer.from("image-data");
      const result = await companyService.uploadCompanyLogo("admin-1", "comp-1", {
        original: { filename: "logo.png", mimeType: "image/png", data: buffer },
        mini: { filename: "logo-mini.png", mimeType: "image/png", data: buffer },
      });

      expect(mockCompanyRepo.deleteLogoFromGridFS).toHaveBeenCalledWith("comp-1", "old-orig-id");
      expect(mockCompanyRepo.deleteLogoFromGridFS).toHaveBeenCalledWith("comp-1", "old-mini-id");
      expect(result.logoOriginalFileId?.toString()).toBe("new-orig-id");
    });

    it("should throw AppError(404) in getCompanyLogo if logo fileId does not exist", async () => {
      (mockCompanyRepo.findById as any).mockResolvedValue({
        _id: new ObjectId(),
        logoMiniFileId: null,
      });

      expect(companyService.getCompanyLogo("comp-1", "mini")).rejects.toThrow(
        new AppError(404, "Company logo (mini) not found")
      );
    });
  });
});

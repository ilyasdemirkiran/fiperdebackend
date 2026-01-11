import { CompanyRepository } from "@/repositories/company.repository";
import { CompanyInviteRepository } from "@/repositories/company-invite.repository";
import { UserRepository } from "@/repositories/user.repository";
import { AppError } from "@/middleware/error-handler";
import { ObjectId } from "mongodb";
import { Timestamp } from "firebase-admin/firestore";
import type { Company } from "@/types/company/company";
import type { CompanyInvite } from "@/types/company/company_invite";
import type { FIUser } from "@/types/user/fi_user";
import { logger } from "@/utils/logger";

export class CompanyService {
  private companyRepo: CompanyRepository;
  private inviteRepo: CompanyInviteRepository;
  private userRepo: UserRepository;

  constructor() {
    this.companyRepo = new CompanyRepository();
    this.inviteRepo = new CompanyInviteRepository();
    this.userRepo = new UserRepository();
  }

  async createCompany(userId: string, name: string): Promise<Company> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    if (user.companyId) throw new AppError(400, "User already has a company");

    const companyId = new ObjectId().toHexString();

    // Creator becomes admin
    const company: Company = {
      _id: companyId,
      name,
      creatorUserId: userId,
      userIds: [userId],
      registrationAgreement: true,
      createdAt: Timestamp.now(),
    };

    await this.companyRepo.create(company);
    await this.userRepo.update(userId, { companyId, role: "admin" });

    logger.info("Company created", { companyId, userId });
    return company;
  }

  async inviteUser(
    inviterId: string,
    companyId: string,
    phone: string
  ): Promise<CompanyInvite> {
    const inviter = await this.userRepo.findById(inviterId);
    if (!inviter) throw new AppError(404, "Inviter not found");
    if (inviter.companyId !== companyId) throw new AppError(403, "Not authorized to invite for this company");
    if (inviter.role === "user") throw new AppError(403, "User role cannot invite");

    // Check if already invited (pending)
    const existingInvite = await this.inviteRepo.findPendingByPhoneAndCompany(phone, companyId);
    if (existingInvite) throw new AppError(400, "User already invited");

    // Check if user exists to fill invitedUserId
    const invitedUser = await this.userRepo.findByPhoneNumber(phone);
    if (invitedUser && invitedUser.companyId) {
      throw new AppError(400, "User is already in a company");
    }

    const invite: CompanyInvite = {
      _id: new ObjectId().toHexString(),
      companyId,
      inviterUserId: inviterId,
      invitedUserId: invitedUser?._id || "",
      invitedPhoneNumber: phone,
      status: "pending",
      createdAt: Timestamp.now(),
    };

    await this.inviteRepo.create(invite);
    logger.info("User invited", { companyId, phone });
    return invite;
  }

  async respondToInvite(userId: string, inviteId: string, accept: boolean): Promise<void> {
    const invite = await this.inviteRepo.findById(inviteId);
    if (!invite) throw new AppError(404, "Invite not found");
    if (invite.status !== "pending") throw new AppError(400, "Invite no longer pending");

    // If invitedUserId was set, verify
    if (invite.invitedUserId && invite.invitedUserId !== userId) {
      throw new AppError(403, "Invite does not belong to you");
    }

    // If not set, verify phone matches user
    if (!invite.invitedUserId) {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new AppError(404, "User not found");

      // Normalize comparison (remove spaces etc)
      if (user.phoneNumber !== invite.invitedPhoneNumber) {
        throw new AppError(403, "Invite phone number mismatch");
      }
    }

    if (!accept) {
      await this.inviteRepo.updateStatus(inviteId, "rejected");
      logger.info("Invite rejected", { inviteId, userId });
      return;
    }

    const user = await this.userRepo.findById(userId);
    if (user?.companyId) throw new AppError(400, "You are already in a company");

    // Accept logic
    await this.inviteRepo.updateStatus(inviteId, "accepted");
    await this.companyRepo.addUser(invite.companyId, userId);
    await this.userRepo.update(userId, { companyId: invite.companyId, role: "user" });

    logger.info("Invite accepted", { inviteId, userId, companyId: invite.companyId });
  }

  async getCompanyInvites(userId: string, companyId: string): Promise<CompanyInvite[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    if (user.companyId !== companyId) throw new AppError(403, "Not authorized");

    return await this.inviteRepo.findByCompanyId(companyId);
  }

  async getMyInvites(userId: string): Promise<CompanyInvite[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");

    const invites = await this.inviteRepo.findPendingByPhone(user.phoneNumber);
    if (invites.length === 0) return [];

    const companyIds = [...new Set(invites.map((i) => i.companyId))];
    const companies = await this.companyRepo.findByIds(companyIds);
    const companyMap = new Map(companies.map((c) => [c._id, c.name]));

    return invites.map((invite) => ({
      ...invite,
      companyName: companyMap.get(invite.companyId),
    }));
  }

  async getMyCompany(userId: string): Promise<Company | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");

    const company = await this.companyRepo.findById(user.companyId ?? '');

    return company;
  }

  async getCompanyUsers(userId: string, companyId: string): Promise<FIUser[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    if (user.companyId !== companyId) throw new AppError(403, "Not authorized");

    return await this.userRepo.findByCompanyId(companyId);
  }

  async promoteUser(requesterId: string, companyId: string, targetUserId: string): Promise<void> {
    const requester = await this.userRepo.findById(requesterId);
    if (!requester || requester.companyId !== companyId || requester.role !== "admin") {
      throw new AppError(403, "Not authorized to promote users");
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new AppError(404, "Company not found");

    if (company.creatorUserId === targetUserId) {
      throw new AppError(400, "Cannot change role of company owner");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser || targetUser.companyId !== companyId) {
      throw new AppError(404, "Target user not found in company");
    }

    await this.userRepo.update(targetUserId, { role: "admin" });
    logger.info("User promoted", { companyId, targetUserId, requesterId });
  }

  async demoteUser(requesterId: string, companyId: string, targetUserId: string): Promise<void> {
    const requester = await this.userRepo.findById(requesterId);
    if (!requester || requester.companyId !== companyId || requester.role !== "admin") {
      throw new AppError(403, "Not authorized to demote users");
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new AppError(404, "Company not found");

    if (company.creatorUserId === targetUserId) {
      throw new AppError(400, "Cannot change role of company owner");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser || targetUser.companyId !== companyId) {
      throw new AppError(404, "Target user not found in company");
    }

    await this.userRepo.update(targetUserId, { role: "user" });
    logger.info("User demoted", { companyId, targetUserId, requesterId });
  }

  async leaveCompany(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    if (!user.companyId) throw new AppError(400, "User is not in a company");

    const companyId = user.companyId;
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new AppError(404, "Company not found");

    if (company.creatorUserId === userId) {
      throw new AppError(400, "Company owner cannot leave the company");
    }

    await this.companyRepo.removeUser(companyId, userId);
    await this.userRepo.update(userId, { companyId: undefined, role: "user" });

    logger.info("User left company", { companyId, userId });
  }

  async deleteInvite(requesterId: string, inviteId: string): Promise<void> {
    const requester = await this.userRepo.findById(requesterId);
    if (!requester || !requester.companyId || requester.role !== "admin") {
      throw new AppError(403, "Not authorized to delete invites");
    }

    const invite = await this.inviteRepo.findById(inviteId);
    if (!invite) throw new AppError(404, "Invite not found");

    if (invite.companyId !== requester.companyId) {
      throw new AppError(403, "Invite belongs to another company");
    }

    await this.inviteRepo.delete(inviteId);
    logger.info("Invite deleted", { inviteId, requesterId });
  }

  async updateCompanyName(userId: string, name: string): Promise<Company> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    if (!user.companyId) throw new AppError(400, "User is not in a company");
    if (user.role !== "admin") throw new AppError(403, "Only admins can update company name");

    const company = await this.companyRepo.findById(user.companyId);
    if (!company) throw new AppError(404, "Company not found");

    const updated = await this.companyRepo.update(user.companyId, { name });
    if (!updated) throw new AppError(500, "Failed to update company");

    logger.info("Company name updated", { companyId: user.companyId, name, userId });
    return updated;
  }
}

import { Collection } from "mongodb";
import { getCoreDatabase } from "@/config/database";
import type { CompanyInvite } from "@/types/company/company_invite";
import { logger } from "@/utils/logger";
import { Timestamp } from "firebase-admin/firestore";

export class CompanyInviteRepository {
  private getCollection(): Collection<CompanyInvite> {
    return getCoreDatabase().collection<CompanyInvite>("company_invites");
  }

  async create(invite: CompanyInvite): Promise<CompanyInvite> {
    try {
      await this.getCollection().insertOne(invite as any);
      return invite;
    } catch (error) {
      logger.error("Failed to create invite", error);
      throw error;
    }
  }

  async findById(id: string): Promise<CompanyInvite | null> {
    try {
      const doc = await this.getCollection().findOne({ _id: id } as any);
      return doc as CompanyInvite | null;
    } catch (error) {
      logger.error("Failed to find invite", error);
      throw error;
    }
  }

  async findPendingByPhoneAndCompany(
    phone: string,
    companyId: string
  ): Promise<CompanyInvite | null> {
    try {
      const doc = await this.getCollection().findOne({
        invitedPhoneNumber: phone,
        companyId,
        status: "pending",
      } as any);
      return doc as CompanyInvite | null;
    } catch (error) {
      logger.error("Failed to find pending invite", error);
      throw error;
    }
  }

  async updateStatus(id: string, status: CompanyInvite["status"]): Promise<void> {
    try {
      await this.getCollection().updateOne(
        { _id: id } as any,
        {
          $set: {
            status,
            updatedAt: Timestamp.now()
          }
        }
      );
    } catch (error) {
      logger.error("Failed to update invite status", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.getCollection().deleteOne({ _id: id } as any);
      const deleted = result.deletedCount > 0;
      if (deleted) {
        logger.info("Invite deleted", { inviteId: id });
      }
      return deleted;
    } catch (error) {
      logger.error("Failed to delete invite", error);
      throw error;
    }
  }
  async findByCompanyId(companyId: string): Promise<CompanyInvite[]> {
    try {
      const docs = await this.getCollection().find({ companyId } as any).toArray();
      return docs as CompanyInvite[];
    } catch (error) {
      logger.error("Failed to find invites by company", error);
      throw error;
    }
  }

  async findPendingByPhone(phone: string): Promise<CompanyInvite[]> {
    try {
      const docs = await this.getCollection().find({
        invitedPhoneNumber: phone,
        status: "pending",
      } as any).toArray();
      return docs as CompanyInvite[];
    } catch (error) {
      logger.error("Failed to find pending invites by phone", error);
      throw error;
    }
  }
}

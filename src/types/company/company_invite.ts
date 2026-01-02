import { z } from "zod";
import { timestampSchema } from "@/types/timestamp";
import { phoneNumberSchema } from "@/types/phone_number";

export const companyInviteStatusSchema = z.enum(["pending", "accepted", "rejected", "cancelled"]);
export type CompanyInviteStatus = z.infer<typeof companyInviteStatusSchema>;

export const companyInviteSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  invitedPhoneNumber: phoneNumberSchema,
  invitedUserId: z.string(),
  inviterUserId: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  status: companyInviteStatusSchema,
});

export type CompanyInvite = z.infer<typeof companyInviteSchema>;

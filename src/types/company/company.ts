import { z } from "zod";
import { timestampSchema } from "@/types/timestamp";

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(2, "En az 2 karakter gereklidir."),
  registrationAgreement: z.boolean(),
  userIds: z.array(z.string()),
  creatorUserId: z.string(),
  createdAt: timestampSchema,
});

export type Company = z.infer<typeof companySchema>;
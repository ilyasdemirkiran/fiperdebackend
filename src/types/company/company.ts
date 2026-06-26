import {z} from "zod";
import {timestampSchema} from "@/types/timestamp";
import {ObjectId} from "mongodb";

export const companySchema = z.object({
  _id: z.custom<ObjectId>(),
  name: z.string().min(2, "En az 2 karakter gereklidir."),
  registrationAgreement: z.boolean(),
  userIds: z.array(z.string()),
  creatorUserId: z.string(),
  createdAt: timestampSchema,
  logoOriginalFileId: z.custom<ObjectId>().nullable().optional(),
  logoMiniFileId: z.custom<ObjectId>().nullable().optional(),
});

export type Company = z.infer<typeof companySchema>;
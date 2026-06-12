import { z } from "zod";
import { timestampSchema } from "@/types/timestamp";
import { ObjectId } from "mongodb";

export const companyNoteSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  companyId: z.custom<ObjectId>(),
  userId: z.string(), // Firebase UID of the sudo user
  note: z.string().min(1, "Not içeriği boş olamaz"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});

export type CompanyNote = z.infer<typeof companyNoteSchema>;
export type CompanyNoteDb = CompanyNote;

export const createCompanyNoteSchema = companyNoteSchema.omit({
  _id: true,
  updatedAt: true,
});

export const updateCompanyNoteSchema = companyNoteSchema.omit({
  _id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type CreateCompanyNoteInput = z.infer<typeof createCompanyNoteSchema>;
export type UpdateCompanyNoteInput = z.infer<typeof updateCompanyNoteSchema>;

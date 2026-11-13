import { z } from "zod";
import { timestampSchema } from "@/types/timestamp";

export const pageVisitSchema = z.object({
  _id: z.any().optional(),
  userId: z.string(),
  userName: z.string(),
  userRole: z.string().optional(),
  phoneNumber: z.string().optional(),
  path: z.string(),
  platform: z.enum(["web", "ios", "android"]).or(z.string()),
  date: z.string(), // YYYY-MM-DD
  createdAt: timestampSchema,
});

export type PageVisitDb = z.infer<typeof pageVisitSchema>;


import z from "zod";
import { ObjectId } from "mongodb";
import { timestampSchema } from "@/types/timestamp";

export const customerNoteSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  customerId: z.custom<ObjectId>(),
  userId: z.custom<ObjectId>(),
  note: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});

export type CustomerNote = z.infer<typeof customerNoteSchema>;
export type CustomerNoteDb = CustomerNote;
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
export type UpdateCustomerNoteInput = z.infer<typeof updateCustomerNoteSchema>;

export const createCustomerNoteSchema = customerNoteSchema.omit({
  _id: true,
  updatedAt: true,
});

export const updateCustomerNoteSchema = customerNoteSchema.omit({
  _id: true,
  customerId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();
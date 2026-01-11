import { z } from 'zod';
import { ObjectId } from 'mongodb';

export const customerImageLabelSchema = z
  .object({
    _id: z.custom<ObjectId>().optional(),
    name: z.string().min(1, "En az 1 karakter gereklidir."),
  });

export type CustomerImageLabel = z.infer<typeof customerImageLabelSchema>;
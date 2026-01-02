import { z } from 'zod';

export const customerImageLabelSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, "En az 1 karakter gereklidir."),
  });

export type CustomerImageLabel = z.infer<typeof customerImageLabelSchema>;
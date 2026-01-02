import { z } from "zod";

export const currencySchema = z.enum(["TRY", "USD", "EUR"]);
export type Currency = z.infer<typeof currencySchema>;
import { z } from "zod";
import { currencySchema } from "@/types/currency";
import { timestampSchema } from "@/types/timestamp";
import { ObjectId } from "mongodb";

export const quoteStatusSchema = z.enum(["draft", "sent_for_approval", "approved", "denied"]);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const quoteItemSchema = z.object({
  id: z.string(), // Local ID within the quote/room
  productId: z.custom<ObjectId>(),
  name: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number(), // Original price in originalCurrency
  originalCurrency: currencySchema,
  convertedUnitPrice: z.number(), // Price in quote base currency (using conversion rate)
  totalPrice: z.number(), // quantity * convertedUnitPrice
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;

export const quoteRoomSchema = z.object({
  id: z.string(), // Unique ID within the quote
  name: z.string(),
  items: z.array(quoteItemSchema).default([]),
  total: z.number().default(0),
});
export type QuoteRoom = z.infer<typeof quoteRoomSchema>;

export const quoteSchema = z.object({
  _id: z.custom<ObjectId>().optional(),
  companyId: z.string(),
  quoteNumber: z.string(),
  customerId: z.custom<ObjectId>().optional(),
  customerName: z.string().optional(),
  creatorId: z.string(),
  creatorName: z.string().optional(),
  currency: currencySchema,
  conversions: z.record(currencySchema, z.number()).default({
    EUR: 1.00,
    USD: 1.00,
    TRY: 1.00,
  }),
  rooms: z.array(quoteRoomSchema).default([]),
  status: quoteStatusSchema.default("draft"),
  total: z.number().default(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
});

export type Quote = z.infer<typeof quoteSchema>;

// Input schemas
export const createQuoteSchema = z.object({
  currency: currencySchema,
});

export const updateQuoteCustomerSchema = z.object({
  customerId: z.string().optional(),
  newCustomer: z.object({
    name: z.string().min(2),
    surname: z.string().min(2),
    phoneNumber: z.string().optional(),
  }).optional(),
});

export const updateQuoteConversionsSchema = z.record(currencySchema, z.number());

export const addRoomSchema = z.object({
  name: z.string().min(1),
});

export const addItemsToRoomSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    customPrice: z.number().optional(), // If provided, overrides catalog price
  })),
});

export const updateQuoteItemSchema = z.object({
  quantity: z.number().positive().optional(),
  customPrice: z.number().optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteCustomerInput = z.infer<typeof updateQuoteCustomerSchema>;
export type UpdateQuoteConversionsInput = z.infer<typeof updateQuoteConversionsSchema>;
export type AddRoomInput = z.infer<typeof addRoomSchema>;
export type AddItemsToRoomInput = z.infer<typeof addItemsToRoomSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;

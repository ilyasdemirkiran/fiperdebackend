import type {Collection} from "mongodb";
import type {Quote, QuoteItemLabel} from "@/types/quotes/quote";
import {getDatabaseForCompany} from "@/config/database";

export const QUOTE_COLLECTION = {
  quotes: "quotes",
  quoteItemLabel: "quote_item_label",
}

export function getQuotesCollection(companyId: string): Collection<Quote> {
  return getDatabaseForCompany(companyId)
    .collection<Quote>(QUOTE_COLLECTION.quotes);
}

export function getQuoteItemLabelCollection(companyId: string): Collection<QuoteItemLabel> {
  return getDatabaseForCompany(companyId)
    .collection<QuoteItemLabel>(QUOTE_COLLECTION.quoteItemLabel);
}
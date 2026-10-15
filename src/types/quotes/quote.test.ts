import { describe, expect, test } from "bun:test";
import { quoteItemSchema, updateQuoteItemSchema } from "./quote";

describe("Quote Item Discount Schema Tests", () => {
  test("quoteItemSchema should parse discount fields properly", () => {
    const item = quoteItemSchema.parse({
      id: "item1",
      name: "Tül Perde",
      quantity: 2,
      unitPrice: 100,
      originalCurrency: "TRY",
      convertedUnitPrice: 100,
      discountType: "percentage",
      discountValue: 10,
      discountAmount: 20,
      totalPrice: 180,
    });

    expect(item.discountType).toBe("percentage");
    expect(item.discountValue).toBe(10);
    expect(item.discountAmount).toBe(20);
    expect(item.totalPrice).toBe(180);
  });

  test("quoteItemSchema should have default discountAmount = 0", () => {
    const item = quoteItemSchema.parse({
      id: "item2",
      name: "Fon Perde",
      quantity: 1,
      unitPrice: 200,
      originalCurrency: "USD",
      convertedUnitPrice: 200,
      totalPrice: 200,
    });

    expect(item.discountAmount).toBe(0);
    expect(item.discountType).toBeUndefined();
    expect(item.discountValue).toBeUndefined();
  });

  test("updateQuoteItemSchema should accept discount updates", () => {
    const validUpdate = updateQuoteItemSchema.parse({
      discountType: "amount",
      discountValue: 25,
    });
    expect(validUpdate.discountType).toBe("amount");
    expect(validUpdate.discountValue).toBe(25);

    const clearDiscount = updateQuoteItemSchema.parse({
      discountType: null,
      discountValue: null,
    });
    expect(clearDiscount.discountType).toBeNull();
    expect(clearDiscount.discountValue).toBeNull();
  });
});

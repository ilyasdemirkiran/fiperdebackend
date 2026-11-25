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

describe("Quote Item Description Schema Tests", () => {
  test("quoteItemSchema should accept description up to 300 chars", () => {
    const validDesc = "A".repeat(300);
    const item = quoteItemSchema.parse({
      id: "item1",
      name: "Tül Perde",
      quantity: 1,
      unitPrice: 100,
      originalCurrency: "TRY",
      convertedUnitPrice: 100,
      totalPrice: 100,
      description: validDesc,
    });
    expect(item.description).toBe(validDesc);
  });

  test("quoteItemSchema should reject description over 300 chars", () => {
    const invalidDesc = "A".repeat(301);
    expect(() =>
      quoteItemSchema.parse({
        id: "item1",
        name: "Tül Perde",
        quantity: 1,
        unitPrice: 100,
        originalCurrency: "TRY",
        convertedUnitPrice: 100,
        totalPrice: 100,
        description: invalidDesc,
      })
    ).toThrow();
  });
});

describe("Quote Item VAT / KDV Schema Tests", () => {
  test("quoteItemSchema should accept vatRate = 0 (KDV 0 seçilebilir)", () => {
    const item = quoteItemSchema.parse({
      id: "item1",
      name: "Tül Perde",
      quantity: 1,
      unitPrice: 100,
      originalCurrency: "TRY",
      convertedUnitPrice: 100,
      totalPrice: 100,
      vatRate: 0,
      vatAmount: 0,
    });
    expect(item.vatRate).toBe(0);
    expect(item.vatAmount).toBe(0);
  });

  test("quoteItemSchema should accept positive vatRate (e.g. 20%)", () => {
    const item = quoteItemSchema.parse({
      id: "item1",
      name: "Tül Perde",
      quantity: 1,
      unitPrice: 100,
      originalCurrency: "TRY",
      convertedUnitPrice: 100,
      totalPrice: 100,
      vatRate: 20,
      vatAmount: 20,
      totalPriceWithVat: 120,
    });
    expect(item.vatRate).toBe(20);
    expect(item.vatAmount).toBe(20);
    expect(item.totalPriceWithVat).toBe(120);
  });

  test("quoteItemSchema should reject negative vatRate or vatRate > 100", () => {
    expect(() =>
      quoteItemSchema.parse({
        id: "item1",
        name: "Tül Perde",
        quantity: 1,
        unitPrice: 100,
        originalCurrency: "TRY",
        convertedUnitPrice: 100,
        totalPrice: 100,
        vatRate: -1,
      })
    ).toThrow();

    expect(() =>
      quoteItemSchema.parse({
        id: "item1",
        name: "Tül Perde",
        quantity: 1,
        unitPrice: 100,
        originalCurrency: "TRY",
        convertedUnitPrice: 100,
        totalPrice: 100,
        vatRate: 101,
      })
    ).toThrow();
  });
});

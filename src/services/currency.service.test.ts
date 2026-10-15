import { describe, expect, it, mock, beforeEach, spyOn } from "bun:test";
import { CurrencyService } from "./currency.service";

describe("CurrencyService Unit Tests", () => {
  let currencyService: CurrencyService;

  beforeEach(() => {
    currencyService = new CurrencyService();
  });

  it("should fetch and parse TCMB XML rates properly", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Tarih_Date Tarih="15.10.2026" Date="10/15/2026" Bulten_No="2026/190">
      <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
        <Unit>1</Unit>
        <Isim>ABD DOLARI</Isim>
        <CurrencyName>US DOLLAR</CurrencyName>
        <ForexBuying>34.2500</ForexBuying>
        <ForexSelling>34.3116</ForexSelling>
      </Currency>
      <Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
        <Unit>1</Unit>
        <Isim>EURO</Isim>
        <CurrencyName>EURO</CurrencyName>
        <ForexBuying>37.1500</ForexBuying>
        <ForexSelling>37.2170</ForexSelling>
      </Currency>
    </Tarih_Date>`;

    spyOn(globalThis, "fetch").mockResolvedValue({
      text: () => Promise.resolve(mockXml),
    } as any);

    const result = await currencyService.getCurrencyRates();

    expect(result.Tarih_Date["@_Date"]).toBe("10/15/2026");
    expect(result.Tarih_Date.Currency.length).toBe(2);
    expect(result.Tarih_Date.Currency[0]!["@_CurrencyCode"]).toBe("USD");
    expect(result.Tarih_Date.Currency[0]!.ForexBuying).toBe(34.25);
    expect(result.Tarih_Date.Currency[1]!["@_CurrencyCode"]).toBe("EUR");
    expect(result.Tarih_Date.Currency[1]!.ForexSelling).toBe(37.217);
  });
});

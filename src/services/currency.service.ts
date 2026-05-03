import {XMLParser} from "fast-xml-parser";
import type {TCMBXmlResponse} from "@/types/quotes/quote";

export class CurrencyService {

  getCurrencyRates = async function () {
    const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml");
    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      trimValues: true
    });

    const rawData: TCMBXmlResponse = parser.parse(xmlText);
    rawData.Tarih_Date.Currency = rawData.Tarih_Date.Currency.filter(currency => {
      const code = currency["@_CurrencyCode"];

      // return currencySchema.options.includes(code as Currency);
      return currency;
    });

    return rawData;
  }
}
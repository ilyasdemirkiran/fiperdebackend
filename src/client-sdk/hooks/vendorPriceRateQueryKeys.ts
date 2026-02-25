export const vendorPriceRateQueryKeys = {
  all: ["vendorPriceRates"] as const,
  list: () => [...vendorPriceRateQueryKeys.all, "list"] as const,
};

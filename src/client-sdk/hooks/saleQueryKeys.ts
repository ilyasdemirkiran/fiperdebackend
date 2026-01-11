
export const saleQueryKeys = {
  all: ["sales"],
  byCustomer: (customerId: string) => [...saleQueryKeys.all, "customer", customerId],
  details: () => [...saleQueryKeys.all, "detail"],
  detail: (saleId: string) => [...saleQueryKeys.details(), saleId],
};

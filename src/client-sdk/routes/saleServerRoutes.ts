
export const SaleServerRoutes = {
  list: (customerId: string) => `/customers/${customerId}/sales`,
  create: (customerId: string) => `/customers/${customerId}/sales`,
  getById: (customerId: string, saleId: string) => `/customers/${customerId}/sales/${saleId}`,
  update: (customerId: string, saleId: string) => `/customers/${customerId}/sales/${saleId}`,
  delete: (customerId: string, saleId: string) => `/customers/${customerId}/sales/${saleId}`,

  // Payments
  addPayment: (customerId: string, saleId: string) => `/customers/${customerId}/sales/${saleId}/payments`,
  updatePayment: (customerId: string, saleId: string, logId: string) => `/customers/${customerId}/sales/${saleId}/payments/${logId}`,
  deletePayment: (customerId: string, saleId: string, logId: string) => `/customers/${customerId}/sales/${saleId}/payments/${logId}`,
} as const;

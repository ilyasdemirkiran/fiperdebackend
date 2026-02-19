export const ManagementServerRoutes = {
  // Companies
  companies: "/management/companies",
  promoteUser: (companyId: string, userId: string) => `/management/companies/${companyId}/promote/${userId}`,
  demoteUser: (companyId: string, userId: string) => `/management/companies/${companyId}/demote/${userId}`,

  // Vendors
  vendors: "/management/vendors",
  vendor: (vendorId: string) => `/management/vendors/${vendorId}`,
  vendorAccess: (vendorId: string) => `/management/vendors/${vendorId}/access`,
  vendorPermissions: "/management/vendor-permissions",

  // Vendor Documents
  vendorDocuments: (vendorId: string) => `/management/vendors/${vendorId}/documents`,
  documentDownload: (documentId: string) => `/management/documents/${documentId}/download`,
  deleteDocument: (documentId: string) => `/management/documents/${documentId}`,

  // Products
  createProduct: (vendorId: string) => `/management/vendors/${vendorId}/products`,
  product: (productId: string) => `/management/products/${productId}`,
  bulkCreateProducts: (vendorId: string) => `/management/vendors/${vendorId}/products/bulk`,
  bulkDeleteProducts: (vendorId: string) => `/management/vendors/${vendorId}/products/bulk`,
  bulkUpdateProducts: (vendorId: string) => `/management/vendors/${vendorId}/products/bulk`,

  // Price List Requests
  priceListRequests: "/management/price-list-requests",
  priceListRequestsPending: "/management/price-list-requests/pending",
  priceListRequestsCompleted: "/management/price-list-requests/completed",
  priceListRequestDownload: (requestId: string) => `/management/price-list-requests/${requestId}/download`,
  priceListRequestComplete: (requestId: string) => `/management/price-list-requests/${requestId}/complete`,
  priceListRequestDelete: (requestId: string) => `/management/price-list-requests/${requestId}`,
} as const;

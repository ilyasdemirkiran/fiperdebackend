export const ManagementServerRoutes = {
  // Companies
  companies: "/management/companies",
  promoteUser: (companyId: string, userId: string) => `/management/companies/${companyId}/promote/${userId}`,
  demoteUser: (companyId: string, userId: string) => `/management/companies/${companyId}/demote/${userId}`,

  // Vendors
  vendors: "/management/vendors",
  vendor: (vendorId: string) => `/management/vendors/${vendorId}`,
  vendorAccess: (vendorId: string) => `/management/vendors/${vendorId}/access`,
  vendorPdf: (vendorId: string) => `/management/vendors/${vendorId}/pdf`,

  // Products
  createProduct: (vendorId: string) => `/management/vendors/${vendorId}/products`,
  product: (productId: string) => `/management/products/${productId}`,
} as const;

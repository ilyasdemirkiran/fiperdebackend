export const ProductServerRoutes = {
  list: "/products",
  getByVendor: (vendorId: string) => `/products/vendor/${vendorId}`,
  getById: (id: string) => `/products/${id}`,
  create: "/products",
  update: (id: string) => `/products/${id}`,
  delete: (id: string) => `/products/${id}`,
} as const;

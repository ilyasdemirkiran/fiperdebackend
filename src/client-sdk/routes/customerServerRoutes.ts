
export const CustomerServerRoutes = {
  list: "/customers",
  getAll: "/customers/all",
  create: "/customers",
  getById: (id: string) => `/customers/${id}`,
  update: (id: string) => `/customers/${id}`,
  delete: (id: string) => `/customers/${id}`,
} as const;

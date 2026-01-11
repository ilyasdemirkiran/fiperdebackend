
export const CustomerImageLabelServerRoutes = {
  list: "/labels",
  create: "/labels",
  getById: (id: string) => `/labels/${id}`,
  update: (id: string) => `/labels/${id}`,
  delete: (id: string) => `/labels/${id}`,
} as const;

export const VendorServerRoutes = {
  list: "/vendors",
  create: "/vendors",
  getById: (id: string) => `/vendors/${id}`,
  update: (id: string) => `/vendors/${id}`,
  delete: (id: string) => `/vendors/${id}`,

  // Permissions
  grantPermission: (id: string, companyId: string) => `/vendors/${id}/permissions/${companyId}`,
  revokePermission: (id: string, companyId: string) => `/vendors/${id}/permissions/${companyId}`,
  listPermissions: (id: string) => `/vendors/${id}/permissions`,

  // Documents (client gets latest only)
  document: (id: string) => `/vendors/${id}/document`,
  documentMetadata: (id: string) => `/vendors/${id}/document/metadata`,
} as const;

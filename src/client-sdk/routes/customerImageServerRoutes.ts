
export const CustomerImageServerRoutes = {
  // Without customerId
  listAll: "/customers/images",
  createWithoutCustomer: "/customers/images",
  downloadById: (imageId: string) => `/customers/images/${imageId}/download`,

  // With customerId
  list: (customerId: string) => `/customers/${customerId}/images`,
  create: (customerId: string) => `/customers/${customerId}/images`,
  getMetadata: (imageId: string) => `/customers/images/${imageId}`,
  update: (imageId: string) => `/customers/images/${imageId}`,
  delete: (imageId: string) => `/customers/images/${imageId}`,
  download: (imageId: string) => `/customers/images/${imageId}/download`,
  byLabels: "/customers/images/by-labels",

  // Resumable upload
  initUpload: (customerId: string) => `/customers/${customerId}/upload/init`,
  uploadChunk: (customerId: string) => `/customers/${customerId}/upload/chunk`,
  finalizeUpload: (customerId: string) => `/customers/${customerId}/upload/finalize`,
} as const;

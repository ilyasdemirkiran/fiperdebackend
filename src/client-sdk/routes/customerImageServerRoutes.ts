
export const CustomerImageServerRoutes = {
  list: (customerId: string) => `/customers/${customerId}/images`,
  create: (customerId: string) => `/customers/${customerId}/images`,
  getMetadata: (customerId: string, imageId: string) => `/customers/${customerId}/images/${imageId}`,
  update: (customerId: string, imageId: string) => `/customers/${customerId}/images/${imageId}`,
  delete: (customerId: string, imageId: string) => `/customers/${customerId}/images/${imageId}`,
  download: (customerId: string, imageId: string) => `/customers/${customerId}/images/${imageId}/download`,
  byLabels: "/customers/images/by-labels",

  // Resumable upload
  initUpload: (customerId: string) => `/customers/${customerId}/upload/init`,
  uploadChunk: (customerId: string) => `/customers/${customerId}/upload/chunk`,
  finalizeUpload: (customerId: string) => `/customers/${customerId}/upload/finalize`,
} as const;

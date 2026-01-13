export const VendorAttachmentServerRoutes = {
  list: (vendorId: string) => `/vendors/${vendorId}/attachments`,
  getMetadata: (vendorId: string, attachmentId: string) => `/vendors/${vendorId}/attachments/${attachmentId}`,
  preview: (vendorId: string, attachmentId: string) => `/vendors/${vendorId}/attachments/${attachmentId}/preview`,
  download: (vendorId: string, attachmentId: string) => `/vendors/${vendorId}/attachments/${attachmentId}/download`,
  upload: (vendorId: string) => `/vendors/${vendorId}/attachments`,
  update: (vendorId: string, attachmentId: string) => `/vendors/${vendorId}/attachments/${attachmentId}`,
  delete: (vendorId: string, attachmentId: string) => `/vendors/${vendorId}/attachments/${attachmentId}`,
} as const;

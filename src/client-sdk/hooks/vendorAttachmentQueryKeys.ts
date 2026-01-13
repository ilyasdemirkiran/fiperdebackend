export const vendorAttachmentQueryKeys = {
  all: ["vendor-attachments"] as const,
  byVendor: (vendorId: string) => [...vendorAttachmentQueryKeys.all, "byVendor", vendorId] as const,
  detail: (id: string) => [...vendorAttachmentQueryKeys.all, "detail", id] as const,
  preview: (id: string) => [...vendorAttachmentQueryKeys.all, "preview", id] as const,
};

export const productQueryKeys = {
  all: ["products"] as const,
  lists: () => [...productQueryKeys.all, "list"] as const,
  byVendor: (vendorId: string) => [...productQueryKeys.all, "byVendor", vendorId] as const,
  detail: (id: string) => [...productQueryKeys.all, "detail", id] as const,
};

export const vendorQueryKeys = {
  all: ["vendors"] as const,
  lists: () => [...vendorQueryKeys.all, "list"] as const,
  detail: (id: string) => [...vendorQueryKeys.all, "detail", id] as const,
  permissions: (id: string) => [...vendorQueryKeys.detail(id), "permissions"] as const,
  document: (id: string) => [...vendorQueryKeys.detail(id), "document"] as const,
};

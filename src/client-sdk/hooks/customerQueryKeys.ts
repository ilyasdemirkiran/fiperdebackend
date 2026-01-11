
export const customerQueryKeys = {
  all: ["customers"],
  lists: () => [...customerQueryKeys.all, "list"],
  list: (filters: Record<string, any>) => [...customerQueryKeys.lists(), filters],
  details: () => [...customerQueryKeys.all, "detail"],
  detail: (id: string) => [...customerQueryKeys.details(), id],
};

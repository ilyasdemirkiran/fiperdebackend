
export const customerImageQueryKeys = {
  all: ["customer_images"],
  byCustomer: (customerId: string) => [...customerImageQueryKeys.all, "customer", customerId],
  details: () => [...customerImageQueryKeys.all, "detail"],
  detail: (imageId: string) => [...customerImageQueryKeys.details(), imageId],
};

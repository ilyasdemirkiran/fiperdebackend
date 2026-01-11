
export const customerImageLabelQueryKeys = {
  all: ["customer_image_labels"],
  lists: () => [...customerImageLabelQueryKeys.all, "list"],
  details: () => [...customerImageLabelQueryKeys.all, "detail"],
  detail: (id: string) => [...customerImageLabelQueryKeys.details(), id],
};

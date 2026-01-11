import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerImageLabel } from "@/types/customer/image/customer_image_label";
import { customerImageLabelQueryKeys } from "./customerImageLabelQueryKeys";
import { api } from "@/api/apiAxios";
import { CustomerImageLabelServerRoutes } from "../routes/customerImageLabelServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useLabels = (enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageLabelQueryKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageLabel[]>>(CustomerImageLabelServerRoutes.list);
      return data.data;
    },
    enabled,
  });
};

export const useLabel = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageLabelQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageLabel>>(CustomerImageLabelServerRoutes.getById(id));
      return data.data;
    },
    enabled: !!id && enabled,
  });
};

export const useCreateLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await api.post<SuccessResponse<CustomerImageLabel>>(CustomerImageLabelServerRoutes.create, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerImageLabelQueryKeys.lists() });
    },
  });
};

export const useUpdateLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await api.put<SuccessResponse<CustomerImageLabel>>(CustomerImageLabelServerRoutes.update(id), { name });
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerImageLabelQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: customerImageLabelQueryKeys.lists() });
    },
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(CustomerImageLabelServerRoutes.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerImageLabelQueryKeys.lists() });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/types/vendor/product/product";
import { api } from "@/api/apiAxios";
import { ProductServerRoutes } from "../routes/productServerRoutes";
import { productQueryKeys } from "./productQueryKeys";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useProducts = (enabled: boolean = true) => {
  return useQuery({
    queryKey: productQueryKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Product[]>>(ProductServerRoutes.list);
      return data.data;
    },
    enabled,
  });
};

export const useProductsByVendor = (vendorId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: productQueryKeys.byVendor(vendorId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Product[]>>(ProductServerRoutes.getByVendor(vendorId));
      return data.data;
    },
    enabled: !!vendorId && enabled,
  });
};

export const useProduct = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Product>>(ProductServerRoutes.getById(id));
      return data.data;
    },
    enabled: !!id && enabled,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Product>) => {
      const { data } = await api.post<SuccessResponse<Product>>(ProductServerRoutes.create, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const response = await api.put<SuccessResponse<Product>>(ProductServerRoutes.update(id), data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(ProductServerRoutes.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
};

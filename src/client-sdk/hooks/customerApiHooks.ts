import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Customer, CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery } from "@/types/customer/customer";
import { customerQueryKeys } from "./customerQueryKeys";
import { api } from "@/api/apiAxios";
import { CustomerServerRoutes } from "../routes/customerServerRoutes";

type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useCustomers = (query: ListCustomersQuery) => {
  return useQuery({
    queryKey: customerQueryKeys.list(query),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Customer>>(CustomerServerRoutes.list, { params: query });
      return data;
    },
  });
};

export const useAllCustomers = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...customerQueryKeys.all, "all"],
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Customer[]>>(CustomerServerRoutes.getAll);
      return data.data;
    },
    enabled,
  });
};

export const useCustomer = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: customerQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Customer>>(CustomerServerRoutes.getById(id));
      return data.data;
    },
    enabled: !!id && enabled,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data } = await api.post<SuccessResponse<Customer>>(CustomerServerRoutes.create, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCustomerInput }) => {
      const response = await api.put<SuccessResponse<Customer>>(CustomerServerRoutes.update(id), data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(CustomerServerRoutes.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
    },
  });
};

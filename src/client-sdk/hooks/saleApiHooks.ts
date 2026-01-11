import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Sale, AddSale, UpdateSale, AddPaymentLog, UpdatePaymentLog } from "@/types/customer/sale/sale";
import { saleQueryKeys } from "./saleQueryKeys";
import { api } from "@/api/apiAxios";
import { SaleServerRoutes } from "../routes/saleServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

// --- Sale Hooks ---

export const useSales = (customerId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: saleQueryKeys.byCustomer(customerId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Sale[]>>(SaleServerRoutes.list(customerId));
      return data.data;
    },
    enabled: !!customerId && enabled,
  });
};

export const useSale = (customerId: string, saleId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: saleQueryKeys.detail(saleId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Sale>>(SaleServerRoutes.getById(customerId, saleId));
      return data.data;
    },
    enabled: !!saleId && enabled,
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, data }: { customerId: string; data: Pick<AddSale, "totalAmount" | "currency" | "description" | "createdAt"> }) => {
      const response = await api.post<SuccessResponse<Sale>>(SaleServerRoutes.create(customerId), data);
      return response.data;
    },
    onSuccess: (response, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      data,
    }: {
      customerId: string;
      saleId: string;
      data: UpdateSale;
    }) => {
      const response = await api.put<SuccessResponse<Sale>>(SaleServerRoutes.update(customerId, saleId), data);
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useDeleteSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, saleId }: { customerId: string; saleId: string }) => {
      await api.delete(SaleServerRoutes.delete(customerId, saleId));
    },
    onSuccess: (_, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

// --- Payment Log Hooks ---

export const useAddPaymentLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      data,
    }: {
      customerId: string;
      saleId: string;
      data: AddPaymentLog;
    }) => {
      const response = await api.post<SuccessResponse<Sale>>(SaleServerRoutes.addPayment(customerId, saleId), data);
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useUpdatePaymentLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      logId,
      data,
    }: {
      customerId: string;
      saleId: string;
      logId: string;
      data: UpdatePaymentLog;
    }) => {
      const response = await api.put<SuccessResponse<Sale>>(
        SaleServerRoutes.updatePayment(customerId, saleId, logId),
        data
      );
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useDeletePaymentLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      logId,
    }: {
      customerId: string;
      saleId: string;
      logId: string;
    }) => {
      const response = await api.delete<SuccessResponse<Sale>>(SaleServerRoutes.deletePayment(customerId, saleId, logId));
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: saleQueryKeys.byCustomer(customerId) });
    },
  });
};

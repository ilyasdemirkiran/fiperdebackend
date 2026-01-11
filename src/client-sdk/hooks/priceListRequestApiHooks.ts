import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PriceListRequestMetadata } from "@/types/vendor/price_list_request";
import { api } from "@/api/apiAxios";
import { PriceListRequestServerRoutes } from "../routes/priceListRequestServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const priceListRequestQueryKeys = {
  all: ["priceListRequests"] as const,
  list: () => [...priceListRequestQueryKeys.all, "list"] as const,
};

// List my company's price list requests (for admin users)
export const usePriceListRequests = (enabled: boolean = true) => {
  return useQuery({
    queryKey: priceListRequestQueryKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<PriceListRequestMetadata[]>>(
        PriceListRequestServerRoutes.list
      );
      return data.data;
    },
    enabled,
  });
};

// Submit a price list request (for admin users)
export const useSubmitPriceListRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorName,
      file,
      companyName
    }: {
      vendorName: string;
      file: File;
      companyName: string;
    }) => {
      const formData = new FormData();
      formData.append("vendorName", vendorName);
      formData.append("file", file);
      formData.append("companyName", companyName);

      const { data } = await api.post<SuccessResponse<PriceListRequestMetadata>>(
        PriceListRequestServerRoutes.create,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListRequestQueryKeys.list() });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VendorPriceRate } from "@/types/vendor/vendor_price_rate";
import { api } from "@/api/apiAxios";
import { VendorPriceRateServerRoutes } from "../routes/vendorPriceRateServerRoutes";
import { vendorPriceRateQueryKeys } from "./vendorPriceRateQueryKeys";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useVendorPriceRates = (enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorPriceRateQueryKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<VendorPriceRate[]>>(
        VendorPriceRateServerRoutes.list
      );
      return data.data;
    },
    enabled,
  });
};

export const useUpdateVendorPriceRates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rates: { vendorId: string; rate: number }[]) => {
      await api.put(VendorPriceRateServerRoutes.bulkUpdate, rates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorPriceRateQueryKeys.all });
    },
  });
};

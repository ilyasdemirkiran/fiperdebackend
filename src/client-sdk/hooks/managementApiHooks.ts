import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CompanyWithUsers, VendorWithProducts } from "@/types/management/management";
import type { Vendor } from "@/types/vendor/vendor";
import type { Product } from "@/types/vendor/product/product";
import { api } from "@/api/apiAxios";
import { ManagementServerRoutes } from "../routes/managementServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const managementQueryKeys = {
  all: ["management"] as const,
  companies: () => [...managementQueryKeys.all, "companies"] as const,
  vendors: () => [...managementQueryKeys.all, "vendors"] as const,
  vendor: (vendorId: string) => [...managementQueryKeys.all, "vendor", vendorId] as const,
};

// =====================
// COMPANY HOOKS
// =====================

export const useCompaniesWithUsers = (enabled: boolean = true) => {
  return useQuery({
    queryKey: managementQueryKeys.companies(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CompanyWithUsers[]>>(ManagementServerRoutes.companies);
      return data.data;
    },
    enabled,
  });
};

export const usePromoteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const { data } = await api.post<SuccessResponse<{ message: string }>>(
        ManagementServerRoutes.promoteUser(companyId, userId)
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.companies() });
    },
  });
};

export const useDemoteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const { data } = await api.post<SuccessResponse<{ message: string }>>(
        ManagementServerRoutes.demoteUser(companyId, userId)
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.companies() });
    },
  });
};

// =====================
// VENDOR HOOKS
// =====================

export const useManagementVendors = (enabled: boolean = true) => {
  return useQuery({
    queryKey: managementQueryKeys.vendors(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Vendor[]>>(ManagementServerRoutes.vendors);
      return data.data;
    },
    enabled,
  });
};

export const useManagementVendor = (vendorId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: managementQueryKeys.vendor(vendorId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<VendorWithProducts>>(
        ManagementServerRoutes.vendor(vendorId)
      );
      return data.data;
    },
    enabled: !!vendorId && enabled,
  });
};

export const useCreateManagementVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; phone: string; city?: string; district?: string; address?: string }) => {
      const { data } = await api.post<SuccessResponse<Vendor>>(ManagementServerRoutes.vendors, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
    },
  });
};

export const useUpdateManagementVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, data }: { vendorId: string; data: Partial<Vendor> }) => {
      const response = await api.put<SuccessResponse<Vendor>>(
        ManagementServerRoutes.vendor(vendorId),
        data
      );
      return response.data.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendor(vendorId) });
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
    },
  });
};

export const useDeleteManagementVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorId: string) => {
      await api.delete(ManagementServerRoutes.vendor(vendorId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
    },
  });
};

export const useSetVendorAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, companyIds }: { vendorId: string; companyIds: string[] }) => {
      const { data } = await api.put<SuccessResponse<{ message: string }>>(
        ManagementServerRoutes.vendorAccess(vendorId),
        { companyIds }
      );
      return data.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendor(vendorId) });
    },
  });
};

export const useUploadVendorPdf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, pdfUrl }: { vendorId: string; pdfUrl: string }) => {
      const { data } = await api.post<SuccessResponse<{ message: string }>>(
        ManagementServerRoutes.vendorPdf(vendorId),
        { pdfUrl }
      );
      return data.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendor(vendorId) });
    },
  });
};

// =====================
// PRODUCT HOOKS
// =====================

export const useCreateManagementProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      data,
    }: {
      vendorId: string;
      data: { name: string; code: string; price: number; currency: string; description?: string; imageUrl?: string };
    }) => {
      const response = await api.post<SuccessResponse<Product>>(
        ManagementServerRoutes.createProduct(vendorId),
        data
      );
      return response.data.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendor(vendorId) });
    },
  });
};

export const useUpdateManagementProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: Partial<Product> }) => {
      const response = await api.put<SuccessResponse<Product>>(
        ManagementServerRoutes.product(productId),
        data
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
    },
  });
};

export const useDeleteManagementProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(ManagementServerRoutes.product(productId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
    },
  });
};

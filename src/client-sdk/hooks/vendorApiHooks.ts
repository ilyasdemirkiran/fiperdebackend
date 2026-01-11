import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vendor } from "@/types/vendor/vendor";
import type { VendorDocumentMetadata } from "@/types/vendor/vendor_document";
import { api } from "@/api/apiAxios";
import { VendorServerRoutes } from "../routes/vendorServerRoutes";
import { vendorQueryKeys } from "./vendorQueryKeys";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useVendors = (enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorQueryKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Vendor[]>>(VendorServerRoutes.list);
      return data.data;
    },
    enabled,
  });
};

export const useVendor = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Vendor>>(VendorServerRoutes.getById(id));
      return data.data;
    },
    enabled: !!id && enabled,
  });
};

export const useVendorDocumentMetadata = (vendorId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: [...vendorQueryKeys.detail(vendorId), "document"],
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<VendorDocumentMetadata | null>>(
        VendorServerRoutes.documentMetadata(vendorId)
      );
      return data.data;
    },
    enabled: !!vendorId && enabled,
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Vendor>) => {
      const { data } = await api.post<SuccessResponse<Vendor>>(VendorServerRoutes.create, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.lists() });
    },
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Vendor> }) => {
      const response = await api.put<SuccessResponse<Vendor>>(VendorServerRoutes.update(id), data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.lists() });
    },
  });
};

export const useDeleteVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(VendorServerRoutes.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.lists() });
    },
  });
};

export const useVendorPermissions = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorQueryKeys.permissions(id),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<{ companyIds: string[] }>>(VendorServerRoutes.listPermissions(id));
      return data.data.companyIds;
    },
    enabled: !!id && enabled,
  });
};

export const useGrantVendorPermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      await api.post(VendorServerRoutes.grantPermission(id, companyId));
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.permissions(id) });
    },
  });
};

export const useRevokeVendorPermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      await api.delete(VendorServerRoutes.revokePermission(id, companyId));
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorQueryKeys.permissions(id) });
    },
  });
};

// Helper to get document download URL
export const getVendorDocumentUrl = (vendorId: string) => VendorServerRoutes.document(vendorId);

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VendorAttachment, VendorAttachmentMetadata } from "@/types/vendor/vendor_attachment";
import { api } from "@/api/apiAxios";
import { VendorAttachmentServerRoutes } from "../routes/vendorAttachmentServerRoutes";
import { vendorAttachmentQueryKeys } from "./vendorAttachmentQueryKeys";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const useVendorAttachments = (vendorId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorAttachmentQueryKeys.byVendor(vendorId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<VendorAttachmentMetadata[]>>(VendorAttachmentServerRoutes.list(vendorId));
      return data.data;
    },
    enabled: !!vendorId && enabled,
  });
};

export const useVendorAttachment = (vendorId: string, attachmentId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: vendorAttachmentQueryKeys.detail(attachmentId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<VendorAttachment>>(
        VendorAttachmentServerRoutes.getMetadata(vendorId, attachmentId)
      );
      return data.data;
    },
    enabled: !!attachmentId && enabled,
  });
};

export const useUploadVendorAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, formData }: { vendorId: string; formData: FormData }) => {
      const { data } = await api.post<SuccessResponse<VendorAttachment>>(
        VendorAttachmentServerRoutes.upload(vendorId),
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data.data;
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: vendorAttachmentQueryKeys.byVendor(vendorId) });
    },
  });
};

export const useUpdateVendorAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      attachmentId,
      data,
    }: {
      vendorId: string;
      attachmentId: string;
      data: { title?: string; description?: string };
    }) => {
      const response = await api.put<SuccessResponse<VendorAttachment>>(
        VendorAttachmentServerRoutes.update(vendorId, attachmentId),
        data
      );
      return response.data;
    },
    onSuccess: (data, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: vendorAttachmentQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: vendorAttachmentQueryKeys.byVendor(vendorId) });
    },
  });
};

export const useDeleteVendorAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, attachmentId }: { vendorId: string; attachmentId: string }) => {
      await api.delete(VendorAttachmentServerRoutes.delete(vendorId, attachmentId));
    },
    onSuccess: (_, { vendorId }) => {
      queryClient.invalidateQueries({ queryKey: vendorAttachmentQueryKeys.byVendor(vendorId) });
    },
  });
};

export const useVendorAttachmentPreview = (vendorId: string, attachmentId: string, enabled: boolean = false) => {
  return useQuery({
    queryKey: vendorAttachmentQueryKeys.preview(attachmentId),
    queryFn: async () => {
      const response = await api.get(VendorAttachmentServerRoutes.preview(vendorId, attachmentId), {
        responseType: "arraybuffer", // Important for binary data
      });

      // Convert arraybuffer to blob
      const blob = new Blob([response.data], { type: "application/pdf" });
      return blob;
    },
    enabled: !!vendorId && !!attachmentId && enabled,
    staleTime: 1000 * 60 * 60, // 1 hour stale time since preview is unlikely to change
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });
};

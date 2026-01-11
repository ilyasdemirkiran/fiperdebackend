import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerImageMetadata } from "@/types/customer/image/customer_image";
import type { InitUploadInput } from "@/types/common/upload";
import { customerImageQueryKeys } from "./customerImageQueryKeys";
import { api } from "@/api/apiAxios";
import { CustomerImageServerRoutes } from "../routes/customerImageServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

// --- Hooks ---

export const useCustomerImages = (customerId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageQueryKeys.byCustomer(customerId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageMetadata[]>>(CustomerImageServerRoutes.list(customerId));
      return data.data;
    },
    enabled: !!customerId && enabled,
  });
};

export const useCustomerImage = (customerId: string, imageId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageQueryKeys.detail(imageId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageMetadata>>(CustomerImageServerRoutes.getMetadata(customerId, imageId));
      return data.data;
    },
    enabled: !!imageId && enabled,
  });
};

export const useImagesByLabels = (labelIds: string[], enabled: boolean = true) => {
  return useQuery({
    queryKey: [...customerImageQueryKeys.all, "byLabels", ...labelIds.sort()],
    queryFn: async () => {
      const { data } = await api.post<SuccessResponse<CustomerImageMetadata[]>>(
        CustomerImageServerRoutes.byLabels,
        { labelIds }
      );
      return data.data;
    },
    enabled: labelIds.length > 0 && enabled,
  });
};

export const useUploadCustomerImages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, formData }: { customerId: string; formData: FormData }) => {
      const { data } = await api.post<SuccessResponse<CustomerImageMetadata | CustomerImageMetadata[]>>(
        CustomerImageServerRoutes.create(customerId),
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data.data;
    },
    onSuccess: (_, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useUpdateCustomerImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      imageId,
      data,
    }: {
      customerId: string;
      imageId: string;
      data: { title?: string; description?: string; labels?: string[] };
    }) => {
      const response = await api.put<SuccessResponse<CustomerImageMetadata>>(
        CustomerImageServerRoutes.update(customerId, imageId),
        data
      );
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.detail(data._id!.toString()) });
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
    },
  });
};

export const useDeleteCustomerImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, imageId }: { customerId: string; imageId: string }) => {
      await api.delete(CustomerImageServerRoutes.delete(customerId, imageId));
    },
    onSuccess: (_, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
    },
  });
};

// --- Resumable Upload Hooks ---

export const useInitResumableUpload = () => {
  return useMutation({
    mutationFn: async ({ customerId, input }: { customerId: string; input: InitUploadInput }) => {
      const { data } = await api.post<SuccessResponse<{ uploadId: string }>>(
        CustomerImageServerRoutes.initUpload(customerId),
        input
      );
      return data.data;
    },
  });
};

export const useUploadChunk = () => {
  return useMutation({
    mutationFn: async ({
      customerId,
      uploadId,
      index,
      chunk,
    }: {
      customerId: string;
      uploadId: string;
      index: number;
      chunk: Blob;
    }) => {
      const { data } = await api.post<SuccessResponse<{ uploadedChunks: number[] }>>(
        CustomerImageServerRoutes.uploadChunk(customerId),
        chunk, // Send raw binary
        {
          params: { uploadId, index },
          headers: { "Content-Type": "application/octet-stream" },
        }
      );
      return data.data;
    },
  });
};

export const useFinalizeResumableUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      input,
    }: {
      customerId: string;
      input: { uploadId: string; title: string; description?: string; labels?: string[] };
    }) => {
      const { data } = await api.post<SuccessResponse<CustomerImageMetadata>>(
        CustomerImageServerRoutes.finalizeUpload(customerId),
        input
      );
      return data.data;
    },
    onSuccess: (_, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
    },
  });
};

// --- Image Display Hook ---

/**
 * Fetches image as blob and returns object URL for display in <img> tags
 * Remember to revoke the URL when component unmounts (handled by queryClient)
 */
export const useCustomerImageBlob = (
  customerId: string,
  imageId: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [...customerImageQueryKeys.detail(imageId), "blob"],
    queryFn: async () => {
      const response = await api.get(
        CustomerImageServerRoutes.download(customerId, imageId),
        { responseType: "blob" }
      );
      const blob = response.data as Blob;
      return URL.createObjectURL(blob);
    },
    enabled: !!customerId && !!imageId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - images don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
};

/**
 * Fetches multiple images as blob URLs
 * Useful for gallery/grid views
 */
export const useCustomerImagesWithBlobs = (customerId: string, enabled: boolean = true) => {
  const { data: images, isLoading: isLoadingList, ...rest } = useCustomerImages(customerId, enabled);

  // This gives you the list; individual blobs should be fetched per-image using useCustomerImageBlob
  // Or use the ImageWithBlob component pattern below
  return { images, isLoadingList, ...rest };
};

// Helper for download URL (for direct links/downloads)
export const getCustomerImageDownloadUrl = (customerId: string, imageId: string) => {
  return CustomerImageServerRoutes.download(customerId, imageId);
};

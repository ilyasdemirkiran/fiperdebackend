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

// --- Query Hooks ---

/**
 * List all images (no customerId filter)
 */
export const useAllImages = (enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageQueryKeys.all,
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageMetadata[]>>(CustomerImageServerRoutes.listAll);
      return data.data;
    },
    enabled,
  });
};

/**
 * List images for a specific customer
 */
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

/**
 * Get image metadata by imageId
 */
export const useCustomerImage = (imageId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: customerImageQueryKeys.detail(imageId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CustomerImageMetadata>>(CustomerImageServerRoutes.getMetadata(imageId));
      return data.data;
    },
    enabled: !!imageId && enabled,
  });
};

/**
 * Get images by label IDs (empty array returns all images)
 */
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
    enabled,
  });
};

// --- Mutation Hooks ---

/**
 * Upload image(s) with customerId
 */
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
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.all });
    },
  });
};

/**
 * Upload image(s) without customerId
 */
export const useUploadImages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formData }: { formData: FormData }) => {
      const { data } = await api.post<SuccessResponse<CustomerImageMetadata | CustomerImageMetadata[]>>(
        CustomerImageServerRoutes.createWithoutCustomer,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.all });
    },
  });
};

/**
 * Update image metadata
 */
export const useUpdateCustomerImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      imageId,
      data,
    }: {
      customerId?: string;
      imageId: string;
      data: { title?: string; description?: string; labels?: string[] };
    }) => {
      const response = await api.put<SuccessResponse<CustomerImageMetadata>>(
        CustomerImageServerRoutes.update(imageId),
        data
      );
      return response.data.data;
    },
    onSuccess: (data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.detail(data._id!.toString()) });
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
      }
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.all });
    },
  });
};

/**
 * Delete image
 */
export const useDeleteCustomerImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageId }: { customerId?: string; imageId: string }) => {
      await api.delete(CustomerImageServerRoutes.delete(imageId));
    },
    onSuccess: (_, { customerId }) => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.byCustomer(customerId) });
      }
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.all });
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
      queryClient.invalidateQueries({ queryKey: customerImageQueryKeys.all });
    },
  });
};

// --- Image Display Hooks ---

/**
 * Fetches image as blob by imageId only (no customerId needed)
 */
export const useImageBlob = (
  imageId: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [...customerImageQueryKeys.detail(imageId), "blob"],
    queryFn: async () => {
      const response = await api.get(
        CustomerImageServerRoutes.downloadById(imageId),
        { responseType: "blob" }
      );
      const blob = response.data as Blob;
      return URL.createObjectURL(blob);
    },
    enabled: !!imageId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - images don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
};

/**
 * Fetches image as blob (by imageId only)
 */
export const useCustomerImageBlob = (
  imageId: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [...customerImageQueryKeys.detail(imageId), "blob"],
    queryFn: async () => {
      const response = await api.get(
        CustomerImageServerRoutes.download(imageId),
        { responseType: "blob" }
      );
      const blob = response.data as Blob;
      return URL.createObjectURL(blob);
    },
    enabled: !!imageId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Fetches multiple images as blob URLs
 */
export const useCustomerImagesWithBlobs = (customerId: string, enabled: boolean = true) => {
  const { data: images, isLoading: isLoadingList, ...rest } = useCustomerImages(customerId, enabled);
  return { images, isLoadingList, ...rest };
};

// --- Helpers ---

export const getImageDownloadUrl = (imageId: string) => {
  return CustomerImageServerRoutes.downloadById(imageId);
};

export const getCustomerImageDownloadUrl = (imageId: string) => {
  return CustomerImageServerRoutes.download(imageId);
};

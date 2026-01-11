import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FIUser } from "@/types/user/fi_user";
import { api } from "@/api/apiAxios";
import { AuthServerRoutes } from "../routes/authServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const authQueryKeys = {
  all: ["auth"] as const,
  user: (id: string) => [...authQueryKeys.all, "user", id] as const,
};

export const useUser = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: authQueryKeys.user(userId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<FIUser>>(AuthServerRoutes.getUserById(userId));
      return data.data;
    },
    enabled: !!userId && enabled,
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (input: { token: string; name: string; surname: string }) => {
      const { data } = await api.post<SuccessResponse<FIUser>>(AuthServerRoutes.register, input);
      return data.data;
    },
  });
};

export const useIsNumberRegistered = () => {
  return useMutation({
    mutationFn: async (input: { phone: string }) => {
      const { data } = await api.post<SuccessResponse<{ registered: boolean; hasCompany: boolean }>>(
        AuthServerRoutes.isRegistered,
        input
      );
      return data.data;
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; surname: string }) => {
      const { data } = await api.put<SuccessResponse<FIUser>>(AuthServerRoutes.updateProfile, input);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.user(data._id) });
    },
  });
};

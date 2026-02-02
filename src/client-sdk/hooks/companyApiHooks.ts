import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@/types/company/company";
import type { CompanyInvite } from "@/types/company/company_invite";
import type { FIUser } from "@/types/user/fi_user";
import { api } from "@/api/apiAxios";
import { CompanyServerRoutes } from "../routes/companyServerRoutes";

type SuccessResponse<T> = {
  success: true;
  data: T;
};

export const companyQueryKeys = {
  all: ["company"] as const,
  invites: () => [...companyQueryKeys.all, "invites"] as const,
  myInvites: () => [...companyQueryKeys.all, "my-invites"] as const,
  myCompany: () => [...companyQueryKeys.all, "my-company"] as const,
  users: (companyId: string) => [...companyQueryKeys.all, "users", companyId] as const,
};

export const useCompanyInvites = (enabled: boolean = true) => {
  return useQuery({
    queryKey: companyQueryKeys.invites(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CompanyInvite[]>>(CompanyServerRoutes.getCompanyInvites);
      return data.data;
    },
    enabled,
  });
};

export const useMyInvites = (enabled: boolean = true) => {
  return useQuery({
    queryKey: companyQueryKeys.myInvites(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<CompanyInvite[]>>(CompanyServerRoutes.getMyInvites);
      return data.data;
    },
    enabled,
  });
};

export const useCreateCompany = () => {
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await api.post<SuccessResponse<Company>>(CompanyServerRoutes.create, input);
      return data.data;
    },
  });
};

export const useInviteUser = () => {
  return useMutation({
    mutationFn: async (input: { phone: string }) => {
      const { data } = await api.post<SuccessResponse<CompanyInvite>>(CompanyServerRoutes.invite, input);
      return data.data;
    },
  });
};

export const useRespondToInvite = () => {
  return useMutation({
    mutationFn: async ({ inviteId, accept }: { inviteId: string; accept: boolean }) => {
      const { data } = await api.post<SuccessResponse<{ success: boolean }>>(
        CompanyServerRoutes.respondInvite(inviteId),
        { accept }
      );
      return data.data;
    },
  });
};

export const useMyCompany = (enabled: boolean = true) => {
  return useQuery({
    queryKey: companyQueryKeys.myCompany(),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<Company>>(CompanyServerRoutes.myCompany);
      return data.data;
    },
    enabled,
  });
};

export const useCompanyUsers = (companyId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: companyQueryKeys.users(companyId),
    queryFn: async () => {
      const { data } = await api.get<SuccessResponse<FIUser[]>>(CompanyServerRoutes.users(companyId));
      return data.data;
    },
    enabled: !!companyId && enabled,
  });
};

export const usePromoteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const { data } = await api.post<SuccessResponse<{ success: boolean }>>(
        CompanyServerRoutes.promoteUser(companyId, userId)
      );
      return data.data;
    },
    onSuccess: (_, { companyId }) => {
      // Invalidate company users list
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.users(companyId) });
    },
  });
};

export const useDemoteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const { data } = await api.post<SuccessResponse<{ success: boolean }>>(
        CompanyServerRoutes.demoteUser(companyId, userId)
      );
      return data.data;
    },
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.users(companyId) });
    },
  });
};

export const useRemoveUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const { data } = await api.delete<SuccessResponse<{ success: boolean }>>(
        CompanyServerRoutes.removeUser(companyId, userId)
      );
      return data.data;
    },
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.users(companyId) });
    },
  });
};

export const useLeaveCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SuccessResponse<{ success: boolean }>>(CompanyServerRoutes.leave);
      return data.data;
    },
    onSuccess: () => {
      // Invalidate my company and invites
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.myCompany() });
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.myInvites() });
    },
  });
};

export const useDeleteInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data } = await api.delete<SuccessResponse<{ success: boolean }>>(
        CompanyServerRoutes.deleteInvite(inviteId)
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.invites() });
    },
  });
};

export const useUpdateCompanyName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.put<SuccessResponse<Company>>(
        CompanyServerRoutes.updateName,
        { name }
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.myCompany() });
    },
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<SuccessResponse<{ success: boolean }>>(CompanyServerRoutes.deleteCompany);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.myCompany() });
      queryClient.invalidateQueries({ queryKey: companyQueryKeys.all });
    },
  });
};

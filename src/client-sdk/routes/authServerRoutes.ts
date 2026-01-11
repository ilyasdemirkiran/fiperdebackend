export const AuthServerRoutes = {
  register: "/auth/register",
  isRegistered: "/auth/is-registered",
  getUserById: (id: string) => `/auth/users/${id}`,
  updateProfile: "/auth/me",
} as const;

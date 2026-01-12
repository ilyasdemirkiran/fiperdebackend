import { Hono } from "hono";
import { AuthService } from "@/services/auth.service";
import { successResponse } from "@/utils/response";
import { z } from "zod";
import { phoneNumberSchema } from "@/types/phone_number";
import type { Env } from "@/types/hono";
import { authMiddleware } from "@/middleware/auth";

export const authRoutes = new Hono<Env>();
const authService = new AuthService();

const registerSchema = z.object({
  token: z.string().min(1, "Token zorunludur"),
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  surname: z.string().min(2, "Soyisim en az 2 karakter olmalıdır"),
});

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const { token, name, surname } = registerSchema.parse(body);

  const user = await authService.registerUser(token, { name, surname });

  return c.json(successResponse(user), 201);
});

const isRegisteredSchema = z.object({
  phone: phoneNumberSchema,
});

authRoutes.post("/is-registered", async (c) => {
  const body = await c.req.json();
  const { phone } = isRegisteredSchema.parse(body);

  const result = await authService.isNumberRegistered(phone);

  return c.json(successResponse(result));
});

authRoutes.get("/users/:id", async (c) => {
  const userId = c.req.param("id");

  const user = await authService.getUserById(userId);

  return c.json(successResponse(user));
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  surname: z.string().min(2, "Soyisim en az 2 karakter olmalıdır"),
});

authRoutes.put("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { name, surname } = updateProfileSchema.parse(body);

  const updated = await authService.updateProfile(user._id!, { name, surname });

  return c.json(successResponse(updated));
});

// DELETE /api/auth/me - Delete account
authRoutes.delete("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  await authService.deleteAccount(user._id!);
  return c.json(successResponse({ success: true, message: "Account deleted successfully" }));
});

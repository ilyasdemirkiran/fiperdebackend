import { Hono } from "hono";
import { CompanyService } from "@/services/company.service";
import { authMiddleware } from "@/middleware/auth";
import { successResponse } from "@/utils/response";
import { z } from "zod";
import { phoneNumberSchema } from "@/types/phone_number";
import { type Env } from "@/types/hono";

export const companyRoutes = new Hono<Env>();
const companyService = new CompanyService();

companyRoutes.use("*", authMiddleware);

const createCompanySchema = z.object({
  name: z.string().min(2, "Şirket adı en az 2 karakter olmalıdır"),
});

companyRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { name } = createCompanySchema.parse(body);

  // _id is string here
  const company = await companyService.createCompany(user._id!, name);

  return c.json(successResponse(company), 201);
});

const inviteUserSchema = z.object({
  phone: phoneNumberSchema,
});

companyRoutes.post("/invite", async (c) => {
  const user = c.get("user");

  if (!user.companyId) {
    return c.json({ success: false, error: { message: "Bir şirkete üye değilsiniz" } }, 400);
  }

  const body = await c.req.json();
  const { phone } = inviteUserSchema.parse(body);

  const invite = await companyService.inviteUser(user._id!, user.companyId, phone);

  return c.json(successResponse(invite), 201);
});

const respondInviteSchema = z.object({
  accept: z.boolean(),
});

companyRoutes.post("/invites/:id/respond", async (c) => {
  const user = c.get("user");
  const inviteId = c.req.param("id");
  const body = await c.req.json();
  const { accept } = respondInviteSchema.parse(body);

  await companyService.respondToInvite(user._id!, inviteId, accept);

  return c.json(successResponse({ success: true }));
});

// GET /companies/invites - List all invites for the user's company
companyRoutes.get("/invites", async (c) => {
  const user = c.get("user");

  if (!user.companyId) {
    return c.json({ success: false, error: { message: "Bir şirkete üye değilsiniz" } }, 400);
  }

  const invites = await companyService.getCompanyInvites(user._id!, user.companyId);

  return c.json(successResponse(invites));
});

// GET /companies/my-invites - List pending invites for the current user
companyRoutes.get("/my-invites", async (c) => {
  const user = c.get("user");

  const invites = await companyService.getMyInvites(user._id!);

  return c.json(successResponse(invites));
});

// GET /companies/my-company - Get current user's company details
companyRoutes.get("/my-company", async (c) => {
  const user = c.get("user");
  const company = await companyService.getMyCompany(user._id!);
  return c.json(successResponse(company));
});

const updateCompanyNameSchema = z.object({
  name: z.string().min(2, "Şirket adı en az 2 karakter olmalıdır"),
});

// PUT /companies/name - Update company name (admin only)
companyRoutes.put("/name", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { name } = updateCompanyNameSchema.parse(body);
  const company = await companyService.updateCompanyName(user._id!, name);
  return c.json(successResponse(company));
});

// DELETE /companies/me - Delete company (owner only)
companyRoutes.delete("/me", async (c) => {
  const user = c.get("user");
  await companyService.deleteCompany(user._id!);
  return c.json(successResponse({ success: true, message: "Company deleted successfully" }));
});

// POST /companies/leave - Leave current company
companyRoutes.post("/leave", async (c) => {
  const user = c.get("user");
  await companyService.leaveCompany(user._id!);
  return c.json(successResponse({ success: true }));
});

// DELETE /companies/invites/:inviteId - Delete an invite
companyRoutes.delete("/invites/:inviteId", async (c) => {
  const user = c.get("user");
  const inviteId = c.req.param("inviteId");
  await companyService.deleteInvite(user._id!, inviteId);
  return c.json(successResponse({ success: true }));
});

// GET /companies/:id/users - Get users of a company
companyRoutes.get("/:id/users", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const users = await companyService.getCompanyUsers(user._id!, companyId);
  return c.json(successResponse(users));
});

// POST /companies/:id/users/:userId/promote - Promote user to admin
companyRoutes.post("/:id/users/:userId/promote", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  await companyService.promoteUser(user._id!, companyId, targetUserId);
  return c.json(successResponse({ success: true }));
});

// POST /companies/:id/users/:userId/demote - Demote user from admin
companyRoutes.post("/:id/users/:userId/demote", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  await companyService.demoteUser(user._id!, companyId, targetUserId);
  return c.json(successResponse({ success: true }));
});

// DELETE /companies/:id/users/:userId - Remove user from company
companyRoutes.delete("/:id/users/:userId", async (c) => {
  const user = c.get("user");
  const companyId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  await companyService.removeUserFromCompany(user._id!, companyId, targetUserId);
  return c.json(successResponse({ success: true }));
});

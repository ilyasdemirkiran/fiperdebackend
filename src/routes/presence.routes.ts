import { Hono } from "hono";
import type { Env } from "@/types/hono";
import { authMiddleware } from "@/middleware/auth";
import { presenceService } from "@/services/presence.service";
import { successResponse } from "@/utils/response";
import { z } from "zod";

export const presenceRoutes = new Hono<Env>();

presenceRoutes.use("*", authMiddleware);

const heartbeatSchema = z.object({
  currentPath: z.string().default("/"),
  platform: z.string().default("web"),
});

const pageVisitSchema = z.object({
  path: z.string(),
  platform: z.string().default("web"),
});

// POST /api/presence/heartbeat
presenceRoutes.post("/heartbeat", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = heartbeatSchema.safeParse(body);

  const { currentPath, platform } = parsed.success
    ? parsed.data
    : { currentPath: "/", platform: "web" };

  await presenceService.recordHeartbeat({
    userId: user._id,
    userName: `${user.name} ${user.surname}`.trim(),
    phoneNumber:
      typeof user.phoneNumber === "string"
        ? user.phoneNumber
        : (user.phoneNumber as any)?.nationalNumber ||
          (user.phoneNumber as any)?.number,
    companyId: user.companyId,
    currentPath,
    platform,
    role: user.role,
  });

  return c.json(
    successResponse({
      recorded: true,
      timestamp: Date.now(),
    })
  );
});

// POST /api/presence/page-visit
presenceRoutes.post("/page-visit", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = pageVisitSchema.safeParse(body);

  if (!parsed.success || !user.companyId) {
    return c.json(successResponse({ recorded: false }));
  }

  await presenceService.recordPageVisit({
    userId: user._id,
    userName: `${user.name} ${user.surname}`.trim(),
    userRole: user.role,
    phoneNumber:
      typeof user.phoneNumber === "string"
        ? user.phoneNumber
        : (user.phoneNumber as any)?.nationalNumber ||
          (user.phoneNumber as any)?.number,
    companyId: user.companyId,
    path: parsed.data.path,
    platform: parsed.data.platform,
  });

  return c.json(
    successResponse({
      recorded: true,
      timestamp: Date.now(),
    })
  );
});

// POST /api/presence/offline
presenceRoutes.post("/offline", async (c) => {
  const user = c.get("user");
  presenceService.setUserOffline(user._id);
  return c.json(successResponse({ offline: true }));
});

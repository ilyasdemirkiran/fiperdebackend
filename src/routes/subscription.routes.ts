import {Hono} from "hono";
import type {Env} from "@/types/hono";
import {authMiddleware} from "@/middleware/auth";
import {SubscriptionService} from "@/services/subscription.service";
import {successResponse} from "@/utils/response";

export const subscriptionRoutes = new Hono<Env>();
const subscriptionService = new SubscriptionService();

subscriptionRoutes.use("*", authMiddleware);

subscriptionRoutes.get("/info", async (c) => {
  const user = c.get('user');

  const info = await subscriptionService.getInfo(user);

  return c.json(successResponse(info), 200);
});
import { createMiddleware } from "hono/factory";
import { logger } from "@/utils/logger";
import { type Env } from "@/types/hono";

export const managementAuthMiddleware = createMiddleware<Env>(async (c, next) => {
  try {
    const user = c.get("user");

    if (user.role !== "sudo") {
      return c.json(
        {
          success: false,
          error: { message: "Unauthorized", code: "AUTH_ERROR" },
        },
        403
      );
    }

    await next();
  } catch (error: any) {
    logger.error("Authentication failed", error);
    return c.json(
      {
        success: false,
        error: { message: error.message || "Authentication failed", code: "AUTH_ERROR" },
      },
      401
    );
  }
});

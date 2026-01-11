import { createMiddleware } from "hono/factory";
import { verifyFirebaseToken } from "@/config/firebase";
import { logger, setLogContext } from "@/utils/logger";
import { type Env } from "@/types/hono";
import { UserRepository } from "@/repositories/user.repository";

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
    try {
        const authHeader = c.req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return c.json(
                {
                    success: false,
                    error: { message: "Missing or invalid Authorization header", code: "AUTH_ERROR" },
                },
                401
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the Firebase token
        const decodedToken = await verifyFirebaseToken(token);
        const userId = decodedToken.uid;

        // Fetch user from MongoDB 'users' collection
        const userRepo = new UserRepository();
        const user = await userRepo.findById(userId);

        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { message: "User not found in database", code: "AUTH_ERROR" },
                },
                401
            );
        }

        logger.debug("User authenticated", {
            userId: user._id,
            companyId: user.companyId,
            role: user.role,
        });

        // Set user on context
        c.set("user", user);

        // Update log context
        const userIdStr = user._id;
        setLogContext("companyId", user.companyId);
        setLogContext("userId", userIdStr);

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

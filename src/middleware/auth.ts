import { createMiddleware } from "hono/factory";
import { verifyFirebaseToken, getFirebaseApp } from "@/config/firebase";
import { logger, setLogContext } from "@/utils/logger";
import { fiUserSchema } from "@/types/user/fi_user";
import { type Env } from "@/types/hono";

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

        // Fetch user from Firestore 'users' collection
        const firebaseApp = getFirebaseApp();
        const db = firebaseApp.firestore();
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) {
            return c.json(
                {
                    success: false,
                    error: { message: "User not found in database", code: "AUTH_ERROR" },
                },
                401
            );
        }

        // Validate and parse user data
        const userData = userDoc.data();
        const user = fiUserSchema.parse({
            _id: userData!.id,
            ...userData
        });
        console.log(user);

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

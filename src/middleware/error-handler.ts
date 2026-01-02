import { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { logger } from "@/utils/logger";

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string,
        public details?: any
    ) {
        super(message);
        this.name = "AppError";
    }
}

export const errorHandler: ErrorHandler = (error, c) => {
    // Zod validation errors
    if (error instanceof ZodError) {
        logger.warn("Validation error", { errors: error.errors });
        return c.json(
            {
                success: false,
                error: {
                    message: "Validation failed",
                    code: "VALIDATION_ERROR",
                    details: error.errors,
                },
            },
            400
        );
    }

    // Custom application errors
    if (error instanceof AppError) {
        logger.warn("Application error", { code: error.code, message: error.message });
        return c.json(
            {
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                },
            },
            error.statusCode as 400 | 401 | 403 | 404 | 500
        );
    }

    // Authentication errors
    if (error.message?.includes("Authentication") || error.message?.includes("token")) {
        logger.error("Authentication error", error);
        return c.json(
            {
                success: false,
                error: { message: error.message, code: "AUTH_ERROR" },
            },
            401
        );
    }

    // Generic errors
    logger.error("Unhandled error", error);
    return c.json(
        {
            success: false,
            error: {
                message: "An unexpected error occurred",
                code: "INTERNAL_ERROR",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
        },
        500
    );
};

import { z } from "zod";

const envSchema = z.object({
    PORT: z.string().default("3000").transform(Number),
    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
    MONGODB_URI: z.url(),
    MONGODB_TEST_URI: z.url().optional(),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string(),
    DB_NAME: z.string().default("fiperde"),
    DB_TEST_NAME: z.string().default("fiperde-test"),
});

function loadEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error("❌ Invalid environment variables:");
        console.error(result.error.flatten().fieldErrors);
        process.exit(1);
    }

    return result.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

export const getMongoUri = () => {
    return isTest && env.MONGODB_TEST_URI ? env.MONGODB_TEST_URI : env.MONGODB_URI;
};

export const getDbName = () => {
    return isTest ? env.DB_TEST_NAME : env.DB_NAME;
};

import { z } from "zod";

const envSchema = z.object({
    PORT: z.string().default("3000").transform(Number),
    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
    MONGODB_URI: z.string(),
    MONGODB_TEST_URI: z.string().optional(),
    MONGO_USERNAME: z.string().optional(),
    MONGO_PASSWORD: z.string().optional(),
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

/**
 * Injects URL-encoded credentials into a mongodb:// URI.
 * e.g. mongodb://host:27017/db → mongodb://user:pass@host:27017/db
 */
function injectCredentials(uri: string): string {
    const username = env.MONGO_USERNAME;
    const password = env.MONGO_PASSWORD;

    if (!username || !password) {
        return uri;
    }

    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);

    // Replace mongodb:// with mongodb://user:pass@
    return uri.replace("mongodb://", `mongodb://${encodedUser}:${encodedPass}@`);
}

export const getMongoUri = () => {
    const baseUri = isTest && env.MONGODB_TEST_URI ? env.MONGODB_TEST_URI : env.MONGODB_URI;
    return injectCredentials(baseUri);
};

export const getDbName = () => {
    return isTest ? env.DB_TEST_NAME : env.DB_NAME;
};

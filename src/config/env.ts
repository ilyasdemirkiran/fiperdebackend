import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  MONGODB_URI: z.string(),
  MONGO_ROOT_USERNAME: z.string().optional(),
  MONGO_ROOT_PASSWORD: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string(),
  DB_NAME: z.string().default("fiperde"),
  PAYTR_MERCHANT_ID: z.string().min(1),
  PAYTR_MERCHANT_KEY: z.string().min(1),
  PAYTR_MERCHANT_SALT: z.string().min(1),
  BASE_URL: z.url(),
  MERCHANT_OK_URL: z.url(),
  MERCHANT_FAIL_URL: z.url(),
  APP_VERSION: z.string().default("1.0.0"),
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

/**
 * Injects URL-encoded credentials into a mongodb:// URI.
 * e.g. mongodb://host:27017/db → mongodb://user:pass@host:27017/db
 */
function injectCredentials(uri: string): string {
  const username = env.MONGO_ROOT_USERNAME;
  const password = env.MONGO_ROOT_PASSWORD;

  if (!username || !password) {
    return uri;
  }

  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);

  // Correctly handle the injection into the URI
  // Pattern: mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]
  if (uri.startsWith("mongodb://")) {
    const parts = uri.split("mongodb://");
    // We want to insert user:pass@ after mongodb://
    // If the URI already has a user:pass, this might be tricky, but assuming MONGODB_URI is host-only
    return `mongodb://${encodedUser}:${encodedPass}@${parts[1]}${parts[1]?.includes("?") ? "&" : "?"}authSource=admin`;
  }

  return uri;
}

export const getMongoUri = () => {
  return injectCredentials(env.MONGODB_URI);
};

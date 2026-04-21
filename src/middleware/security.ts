import type { Context, Next } from "hono";

// ─── Bot Guard ───────────────────────────────────────────────────
// Blocks known scanner/bot paths silently (no logging to keep logs clean)

const BLOCKED_EXTENSIONS = [
  ".php",
  ".asp",
  ".aspx",
  ".cgi",
  ".jsp",
  ".env",
  ".ini",
  ".bak",
  ".sql",
  ".xml",
  ".yml",
  ".yaml",
  ".conf",
  ".config",
  ".log",
  ".old",
  ".orig",
  ".save",
  ".swp",
  ".tmp",
];

const BLOCKED_PATH_SEGMENTS = [
  "/wp-",
  "/wordpress",
  "/wp/",
  "/owa/",
  "/geoserver/",
  "/autodiscover/",
  "/ecp/",
  "/.git/",
  "/.env",
  "/.well-known/security.txt",
  "/admin/",
  "/phpmyadmin",
  "/phpMyAdmin",
  "/myadmin",
  "/pma/",
  "/cgi-bin/",
  "/shell",
  "/console",
  "/solr/",
  "/actuator/",
  "/jmx-console",
  "/manager/html",
  "/invoker/",
  "/struts/",
  "/vendor/phpunit",
  "/telescope/",
  "/debug/",
  "/elmah",
  "/trace",
  "/_profiler",
  "/_ignition",
];

/**
 * Bot guard middleware — silently drops known scanner traffic with 404.
 * No logging is performed for these requests to keep server logs clean.
 */
export const botGuard = async (c: Context, next: Next) => {
  const path = c.req.path.toLowerCase();

  // Block known scanner file extensions
  const hasBlockedExtension = BLOCKED_EXTENSIONS.some((ext) =>
    path.endsWith(ext)
  );
  if (hasBlockedExtension) {
    return c.text("Not Found", 404);
  }

  // Block known scanner path patterns
  const hasBlockedSegment = BLOCKED_PATH_SEGMENTS.some((segment) =>
    path.includes(segment.toLowerCase())
  );
  if (hasBlockedSegment) {
    return c.text("Not Found", 404);
  }

  await next();
};

// ─── Rate Limiter ────────────────────────────────────────────────
// Simple in-memory IP-based rate limiter (no external dependencies)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 500; // per window per IP

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware — limits requests per IP to MAX_REQUESTS per minute.
 * Returns 429 if rate limit is exceeded.
 */
export const rateLimiter = async (c: Context, next: Next) => {
  const path = c.req.path.toLowerCase();

  // Skip rate limiter for completely static assets like images, to not block normal grid loading
  if (c.req.method === "GET" && path.includes("/images")) {
    await next();
    return;
  }

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + WINDOW_MS };
    rateLimitStore.set(ip, entry);
  } else {
    entry.count++;
  }

  // Set rate limit headers
  c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
  c.header("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - entry.count)));
  c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));

  if (entry.count > MAX_REQUESTS) {
    return c.json(
      {
        success: false,
        error: {
          message: "Too many requests. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        },
      },
      429
    );
  }

  await next();
};

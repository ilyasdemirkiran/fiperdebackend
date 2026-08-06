package com.ilyasdemirkiran.middleware

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import java.util.concurrent.ConcurrentHashMap

private val BLOCKED_EXTENSIONS = listOf(
    ".php", ".asp", ".aspx", ".cgi", ".jsp", ".env", ".ini", ".bak",
    ".sql", ".xml", ".yml", ".yaml", ".conf", ".config", ".log",
    ".old", ".orig", ".save", ".swp", ".tmp"
)

private val BLOCKED_PATH_SEGMENTS = listOf(
    "/wp-", "/wordpress", "/wp/", "/owa/", "/geoserver/", "/autodiscover/",
    "/ecp/", "/.git/", "/.env", "/.well-known/security.txt", "/admin/",
    "/phpmyadmin", "/myadmin", "/pma/", "/cgi-bin/",
    "/shell", "/console", "/solr/", "/actuator/", "/jmx-console",
    "/manager/html", "/invoker/", "/struts/", "/vendor/phpunit",
    "/telescope/", "/debug/", "/elmah", "/trace", "/_profiler", "/_ignition"
)

private data class RateLimitEntry(var count: Int, val resetTime: Long)
private val rateLimitStore = ConcurrentHashMap<String, RateLimitEntry>()
private const val WINDOW_MS = 60 * 1000L // 1 minute
private const val MAX_REQUESTS = 500

suspend fun checkSecurity(call: ApplicationCall): Boolean {
    if (call.response.isCommitted || call.request.httpMethod == HttpMethod.Options) {
        return true
    }

    val path = call.request.path().lowercase()

    // 1. Bot Guard
    if (BLOCKED_EXTENSIONS.any { path.endsWith(it) } || BLOCKED_PATH_SEGMENTS.any { path.contains(it) }) {
        call.respond(HttpStatusCode.NotFound, "Not Found")
        return false
    }

    // 2. Rate Limiter (skip GET /images)
    if (call.request.httpMethod == HttpMethod.Get && path.contains("/images")) {
        return true
    }

    val ip = call.request.headers["x-forwarded-for"]?.split(",")?.firstOrNull()?.trim()
        ?: call.request.headers["x-real-ip"]
        ?: "unknown"

    val now = System.currentTimeMillis()
    val entry = rateLimitStore.compute(ip) { _, existing ->
        if (existing == null || now > existing.resetTime) {
            RateLimitEntry(1, now + WINDOW_MS)
        } else {
            existing.count++
            existing
        }
    }!!

    try {
        if (!call.response.isCommitted) {
            call.response.headers.append("X-RateLimit-Limit", MAX_REQUESTS.toString())
            call.response.headers.append("X-RateLimit-Remaining", maxOf(0, MAX_REQUESTS - entry.count).toString())
            call.response.headers.append("X-RateLimit-Reset", (entry.resetTime / 1000).toString())
        }
    } catch (e: Exception) {
        // Response headers might be committed
    }

    if (entry.count > MAX_REQUESTS) {
        if (!call.response.isCommitted) {
            call.respond(
                HttpStatusCode.TooManyRequests,
                com.ilyasdemirkiran.utils.errorResponse("Too many requests. Please try again later.", "RATE_LIMIT_EXCEEDED")
            )
        }
        return false
    }

    return true
}

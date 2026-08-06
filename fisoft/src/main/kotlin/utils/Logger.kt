package com.ilyasdemirkiran.utils

import com.ilyasdemirkiran.config.Environment
import org.slf4j.LoggerFactory
import java.time.Instant

object Logger {
    private val logger = LoggerFactory.getLogger("FiperdeLogger")

    fun info(message: String, meta: String? = null) {
        if (Environment.isProduction) {
            logger.info("{\"level\":\"info\",\"message\":\"$message\",\"timestamp\":\"${Instant.now()}\"${if (meta != null) ",\"meta\":$meta" else ""}}")
        } else {
            logger.info("ℹ️  $message ${meta ?: ""}")
        }
    }

    fun warn(message: String, meta: String? = null) {
        if (Environment.isProduction) {
            logger.warn("{\"level\":\"warn\",\"message\":\"$message\",\"timestamp\":\"${Instant.now()}\"${if (meta != null) ",\"meta\":$meta" else ""}}")
        } else {
            logger.warn("⚠️  $message ${meta ?: ""}")
        }
    }

    fun error(message: String, throwable: Throwable? = null, meta: String? = null) {
        if (Environment.isProduction) {
            logger.error("{\"level\":\"error\",\"message\":\"$message\",\"error\":\"${throwable?.message}\",\"timestamp\":\"${Instant.now()}\"${if (meta != null) ",\"meta\":$meta" else ""}}", throwable)
        } else {
            logger.error("❌ $message ${throwable?.message ?: ""}", throwable)
        }
    }

    fun debug(message: String, meta: String? = null) {
        if (!Environment.isProduction) {
            logger.debug("🐛 $message ${meta ?: ""}")
        }
    }

    fun request(method: String, path: String) {
        info("$method $path")
    }

    fun response(method: String, path: String, statusCode: Int, durationMs: Long) {
        val emoji = if (statusCode >= 500) "❌" else if (statusCode >= 400) "⚠️" else "✅"
        info("$emoji $method $path - $statusCode (${durationMs}ms)")
    }
}

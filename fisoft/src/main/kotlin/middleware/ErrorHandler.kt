package com.ilyasdemirkiran.middleware

import com.ilyasdemirkiran.utils.Logger
import com.ilyasdemirkiran.utils.errorResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.StatusPagesConfig
import io.ktor.server.response.*

class AppError(
    val statusCode: HttpStatusCode,
    override val message: String,
    val code: String? = null,
    val details: Any? = null
) : RuntimeException(message)

fun StatusPagesConfig.configureStatusPages() {
    exception<AppError> { call, cause ->
        Logger.warn("Application error: ${cause.message} (${cause.code})")
        call.respond(cause.statusCode, errorResponse(cause.message, cause.code ?: cause.statusCode.value.toString()))
    }

    exception<IllegalArgumentException> { call, cause ->
        Logger.warn("Validation error: ${cause.message}")
        call.respond(HttpStatusCode.BadRequest, errorResponse(cause.message ?: "Invalid request input", "VALIDATION_ERROR"))
    }

    exception<Throwable> { call, cause ->
        Logger.error("Unhandled error: ${cause.message}", cause)
        call.respond(
            HttpStatusCode.InternalServerError,
            errorResponse(
                message = "An unexpected error occurred",
                code = "INTERNAL_ERROR"
            )
        )
    }
}

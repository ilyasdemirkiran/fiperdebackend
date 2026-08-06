package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.publicRoutes() {
    route("/api/public") {
        get("/health") {
            call.respond(
                HttpStatusCode.OK,
                successResponse(mapOf("status" to "healthy", "version" to "1.0.0"))
            )
        }
    }
}

package com.ilyasdemirkiran

import com.ilyasdemirkiran.middleware.checkSecurity
import com.ilyasdemirkiran.routes.*
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    intercept(ApplicationCallPipeline.Plugins) {
        if (call.request.httpMethod == HttpMethod.Options) {
            return@intercept
        }
        if (!checkSecurity(call)) {
            finish()
        }
    }

    routing {
        get("/") {
            call.respond(HttpStatusCode.OK, successResponse(mapOf("status" to "healthy", "version" to "1.0.0")))
        }

        get("/health") {
            call.respond(HttpStatusCode.OK, successResponse(mapOf("status" to "healthy", "version" to "1.0.0")))
        }

        get("/api") {
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "API is running")))
        }

        publicRoutes()
        authRoutes()
        companyRoutes()
        customerRoutes()
        productRoutes()
        quoteRoutes()
        saleRoutes()
        vendorRoutes()
        vendorAttachmentRoutes()
        priceListRequestRoutes()
        customerImageRoutes()
        managementRoutes()
        subscriptionRoutes()
        labelRoutes()
    }
}
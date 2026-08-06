package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.services.SubscriptionService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.subscriptionRoutes() {
    val subscriptionService = SubscriptionService()

    route("/api/subscription") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val sub = subscriptionService.getSubscription(companyId)
            call.respond(HttpStatusCode.OK, successResponse(sub))
        }
    }
}

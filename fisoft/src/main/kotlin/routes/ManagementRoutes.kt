package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateManagement
import com.ilyasdemirkiran.services.ManagementService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.managementRoutes() {
    val managementService = ManagementService()

    route("/api/management") {
        get("/vendors") {
            call.authenticateManagement()
            val vendors = managementService.listVendors()
            call.respond(HttpStatusCode.OK, successResponse(vendors))
        }

        get("/vendor-permissions") {
            call.authenticateManagement()
            val permissions = managementService.listVendorPermissions()
            call.respond(HttpStatusCode.OK, successResponse(permissions))
        }
    }
}

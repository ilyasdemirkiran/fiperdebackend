package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.services.CustomerImageLabelService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class LabelReq(val name: String)

fun Route.labelRoutes() {
    val service = CustomerImageLabelService()

    route("/api/labels") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val labels = service.listLabels(companyId)
            call.respond(HttpStatusCode.OK, successResponse(labels))
        }

        post {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val req = call.receive<LabelReq>()
            val label = service.createLabel(companyId, req.name)
            call.respond(HttpStatusCode.Created, successResponse(label))
        }

        get("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val label = service.getLabel(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(label))
        }

        put("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<LabelReq>()
            val updated = service.updateLabel(companyId, id, req.name)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            service.deleteLabel(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }
    }
}

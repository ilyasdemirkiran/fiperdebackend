package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.services.PriceListRequestService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreatePriceListReq(
    val vendorId: String? = "",
    val vendorName: String,
    val companyName: String? = null,
    val message: String? = null
)

fun Route.priceListRequestRoutes() {
    val service = PriceListRequestService()

    route("/api/price-list-requests") {
        get {
            call.authenticateUser()
            val requests = service.listAllRequests()
            call.respond(HttpStatusCode.OK, successResponse(requests))
        }

        post {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            var vendorName = ""
            var companyName = ""
            var vendorId = ""
            var message: String? = null

            if (call.request.contentType().match(ContentType.Application.Json)) {
                val req = call.receive<CreatePriceListReq>()
                vendorName = req.vendorName
                companyName = req.companyName ?: ""
                vendorId = req.vendorId ?: ""
                message = req.message
            } else {
                val multipart = call.receiveMultipart()
                multipart.forEachPart { part ->
                    if (part is PartData.FormItem) {
                        when (part.name) {
                            "vendorName" -> vendorName = part.value
                            "companyName" -> companyName = part.value
                            "vendorId" -> vendorId = part.value
                            "message" -> message = part.value
                        }
                    }
                    part.dispose()
                }
            }

            if (vendorName.isBlank()) {
                call.respond(HttpStatusCode.BadRequest, mapOf("success" to false, "error" to "Vendor name is required"))
                return@post
            }

            val created = service.createRequest(companyId, companyName, vendorId, vendorName, message)
            call.respond(HttpStatusCode.Created, successResponse(created))
        }
    }
}

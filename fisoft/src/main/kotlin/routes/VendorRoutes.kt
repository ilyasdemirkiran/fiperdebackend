package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.VendorService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateVendorReq(
    val name: String,
    val phone: String,
    val city: String? = null,
    val district: String? = null,
    val address: String? = null
)

@Serializable
data class UpdatePriceRateReq(
    val vendorId: String,
    val rate: Double
)

fun Route.vendorRoutes() {
    val vendorService = VendorService()

    route("/api/vendors") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val vendors = vendorService.listVendorsForCompany(companyId)
            call.respond(HttpStatusCode.OK, successResponse(vendors))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val req = call.receive<CreateVendorReq>()
            val vendor = vendorService.createVendor(user.role, req.name, req.phone, req.city, req.district, req.address)
            call.respond(HttpStatusCode.Created, successResponse(vendor))
        }

        get("/{id}") {
            call.authenticateUser()
            val id = call.parameters["id"] ?: ""
            val vendor = vendorService.getVendor(id)
            call.respond(HttpStatusCode.OK, successResponse(vendor))
        }

        put("/{id}") {
            call.authenticateUser()
            val user = call.currentUser
            val id = call.parameters["id"] ?: ""
            val req = call.receive<CreateVendorReq>()
            val updated = vendorService.updateVendor(user.role, id, req.name, req.phone, req.city, req.district, req.address)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{id}") {
            call.authenticateUser()
            val user = call.currentUser
            val id = call.parameters["id"] ?: ""
            vendorService.deleteVendor(user.role, id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }
    }

    route("/api/vendor-price-rates") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val rates = vendorService.getPriceRatesForCompany(companyId)
            call.respond(HttpStatusCode.OK, successResponse(rates))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val req = call.receive<UpdatePriceRateReq>()
            val updated = vendorService.updatePriceRate(companyId, user.role, req.vendorId, req.rate)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }
    }
}

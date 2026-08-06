package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.SaleService
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateSaleReq(
    val customerId: String,
    val totalAmount: Money,
    val currency: String = "TRY",
    val description: String? = null
)

@Serializable
data class AddPaymentLogReq(
    val amount: Money,
    val currency: String = "TRY",
    val paymentType: String = "cash",
    val description: String? = null
)

fun Route.saleRoutes() {
    val saleService = SaleService()

    route("/api/customers/{customerId}/sales") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val customerId = call.parameters["customerId"] ?: ""
            val sales = saleService.listSalesByCustomer(companyId, customerId)
            call.respond(HttpStatusCode.OK, successResponse(sales))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val customerId = call.parameters["customerId"] ?: ""
            val req = call.receive<CreateSaleReq>()
            val userName = "${user.name} ${user.surname}"
            val sale = saleService.createSale(companyId, user._id, userName, user.role, customerId, req.totalAmount, req.currency, req.description)
            call.respond(HttpStatusCode.Created, successResponse(sale))
        }

        post("/{saleId}/payments") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val saleId = call.parameters["saleId"] ?: ""
            val req = call.receive<AddPaymentLogReq>()
            val userName = "${user.name} ${user.surname}"
            val updated = saleService.addPaymentLog(companyId, saleId, user._id, userName, user.role, req.amount, req.currency, req.paymentType, req.description)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{saleId}") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val saleId = call.parameters["saleId"] ?: ""
            saleService.deleteSale(companyId, saleId, user.role)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }
    }
}

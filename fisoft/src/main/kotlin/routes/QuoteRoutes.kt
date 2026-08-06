package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.CurrencyService
import com.ilyasdemirkiran.services.QuoteService
import com.ilyasdemirkiran.types.quotes.QuoteConversions
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateQuoteReq(
    val currency: String = "TRY",
    val conversions: QuoteConversions = QuoteConversions()
)

@Serializable
data class UpdateQuoteCustomerReq(
    val customerId: String? = null,
    val customerName: String? = null
)

@Serializable
data class UpdateCurrencyReq(val currency: String)

@Serializable
data class UpdateDiscountPercentReq(val discountPercent: Double)

@Serializable
data class AddRoomReq(val name: String)

@Serializable
data class AddItemInputReq(val productId: String, val quantity: Double)

@Serializable
data class AddItemsToRoomReq(val items: List<AddItemInputReq>)

@Serializable
data class AddCustomItemReq(
    val name: String,
    val quantity: Double,
    val unitPrice: Double,
    val currency: String = "TRY"
)

@Serializable
data class UpdateItemReq(
    val quantity: Double? = null,
    val customPrice: Double? = null
)

@Serializable
data class UpdateItemPublicNameReq(val publicName: String)

fun Route.quoteRoutes() {
    val quoteService = QuoteService()
    val currencyService = CurrencyService()

    route("/api/quotes") {
        get {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val quotes = quoteService.listQuotes(companyId, user._id, user.isAdmin())
            call.respond(HttpStatusCode.OK, successResponse(quotes))
        }

        get("/currency/rates") {
            call.authenticateUser()
            val rates = currencyService.getCurrencyRates()
            call.respond(HttpStatusCode.OK, successResponse(rates))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val req = call.receive<CreateQuoteReq>()
            val creatorName = "${user.name} ${user.surname}"
            val quote = quoteService.createQuote(companyId, user._id, creatorName, req.currency, req.conversions)
            call.respond(HttpStatusCode.Created, successResponse(quote))
        }

        get("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val quote = quoteService.getQuote(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        patch("/{id}/customer") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<UpdateQuoteCustomerReq>()
            val updated = quoteService.updateQuoteCustomer(companyId, id, req.customerId, req.customerName)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        patch("/{id}/currency") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<UpdateCurrencyReq>()
            val updated = quoteService.updateQuoteCurrency(companyId, id, req.currency)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        patch("/{id}/conversions") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val conversions = call.receive<QuoteConversions>()
            val updated = quoteService.updateQuoteConversions(companyId, id, conversions)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        patch("/{id}/discount") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<UpdateDiscountPercentReq>()
            val updated = quoteService.updateDiscountPercent(companyId, id, req.discountPercent)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        // Room operations
        post("/{id}/rooms") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<AddRoomReq>()
            val quote = quoteService.addRoom(companyId, id, req.name)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        patch("/{id}/rooms/{roomId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val req = call.receive<AddRoomReq>()
            val quote = quoteService.updateRoomName(companyId, id, roomId, req.name)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        delete("/{id}/rooms/{roomId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val quote = quoteService.deleteRoom(companyId, id, roomId)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        // Item operations inside rooms
        post("/{id}/rooms/{roomId}/items") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val req = call.receive<AddItemsToRoomReq>()
            val itemsInput = req.items.map { Pair(it.productId, it.quantity) }
            val quote = quoteService.addItemsToRoom(companyId, id, roomId, itemsInput)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        post("/{id}/rooms/{roomId}/custom-items") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val req = call.receive<AddCustomItemReq>()
            val quote = quoteService.addCustomItemToRoom(companyId, id, roomId, req.name, req.quantity, req.unitPrice, req.currency)
            call.respond(HttpStatusCode.Created, successResponse(quote))
        }

        patch("/{id}/rooms/{roomId}/items/{itemId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val itemId = call.parameters["itemId"] ?: ""
            val req = call.receive<UpdateItemReq>()
            val quote = quoteService.updateItem(companyId, id, roomId, itemId, req.quantity, req.customPrice)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        patch("/{id}/rooms/{roomId}/items/{itemId}/public-name") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val itemId = call.parameters["itemId"] ?: ""
            val req = call.receive<UpdateItemPublicNameReq>()
            val quote = quoteService.updateItemPublicName(companyId, id, roomId, itemId, req.publicName)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        delete("/{id}/rooms/{roomId}/items/{itemId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val roomId = call.parameters["roomId"] ?: ""
            val itemId = call.parameters["itemId"] ?: ""
            val quote = quoteService.removeItem(companyId, id, roomId, itemId)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        // Approval workflow
        post("/{id}/submit") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val quote = quoteService.submitForApproval(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        post("/{id}/approve") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val quote = quoteService.approveQuote(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        post("/{id}/deny") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val quote = quoteService.denyQuote(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(quote))
        }

        delete("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            quoteService.deleteQuote(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }
    }
}

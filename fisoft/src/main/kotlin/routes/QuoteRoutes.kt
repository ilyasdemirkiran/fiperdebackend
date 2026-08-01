package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.QuoteRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.services.ExchangeRate
import com.ilyasdemirkiran.services.ExchangeRateService
import com.ilyasdemirkiran.types.quotes.Quote
import com.ilyasdemirkiran.types.quotes.QuoteItem
import com.ilyasdemirkiran.types.quotes.QuoteList
import com.ilyasdemirkiran.types.quotes.QuoteStatus
import com.ilyasdemirkiran.types.request.*
import com.ilyasdemirkiran.types.response.PaginatedResponseData
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.quoteRoutes(
  quoteRepository: QuoteRepository = QuoteRepository(),
  userRepository: UserRepository
) {
  // 1. Exchange Rates Endpoint
  route("/exchange-rates") {
    // GET /exchange-rates/tcmb - Fetch TRY, USD, EUR rates from TCMB
    get("/tcmb") {
      call.authenticate<List<ExchangeRate>>(requireCompany = false, userRepository = userRepository) { _ ->
        val rates = ExchangeRateService.getRates()
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Exchange rates retrieved from TCMB", data = rates))
      }
    }
  }

  // 2. Quotes Endpoints
  route("/quotes") {

    // GET /quotes - List quotes with pagination and search
    get {
      call.authenticate<PaginatedResponseData<Quote>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val search = call.request.queryParameters["search"]
        val customerIdStr = call.request.queryParameters["customerId"]
        val statusStr = call.request.queryParameters["status"]
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 30

        val customerId = customerIdStr?.toUuid()
        val status = statusStr?.let { runCatching { QuoteStatus.valueOf(it) }.getOrNull() }

        val result = quoteRepository.getQuotesByCompanyId(
          companyId = companyId,
          search = search,
          customerId = customerId,
          status = status,
          page = page,
          size = size
        )

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quotes retrieved successfully", data = result))
      }
    }

    // POST /quotes - Create a quote (Fetches currency rate from TCMB automatically)
    post {
      call.authenticate<Quote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateQuoteRequest>()

        val quote = quoteRepository.createQuote(
          companyId = companyId,
          createdByUserId = auth.user.id,
          title = request.title,
          customerId = request.customerId?.toUuid(),
          currency = request.currency,
          notes = request.notes,
          validUntil = request.validUntil
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Quote created successfully", data = quote))
      }
    }

    // GET /quotes/{id} - Get quote details by ID
    get("/{id}") {
      call.authenticate<Quote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val quoteId = (call.parameters["id"] ?: throw IllegalArgumentException("Quote ID is required")).toUuid()

        val quote = quoteRepository.getQuoteById(quoteId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Quote>(false, "Quote not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quote retrieved successfully", data = quote))
      }
    }

    // PUT /quotes/{id} - Update quote details (Title, Currency, Manual CurrencyRate, Status, Notes)
    put("/{id}") {
      call.authenticate<Quote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val quoteId = (call.parameters["id"] ?: throw IllegalArgumentException("Quote ID is required")).toUuid()
        val request = call.receive<UpdateQuoteRequest>()

        val updated = quoteRepository.updateQuote(
          quoteId = quoteId,
          companyId = companyId,
          title = request.title,
          customerId = request.customerId?.toUuid(),
          currency = request.currency,
          currencyRate = request.currencyRate,
          status = request.status,
          notes = request.notes,
          validUntil = request.validUntil
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Quote>(false, "Quote not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quote updated successfully", data = updated))
      }
    }

    // POST /quotes/{id}/discount - Apply discount to overall quote (Percentage or Amount)
    post("/{id}/discount") {
      call.authenticate<Quote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val quoteId = (call.parameters["id"] ?: throw IllegalArgumentException("Quote ID is required")).toUuid()
        val request = call.receive<ApplyQuoteDiscountRequest>()

        val updated = quoteRepository.applyDiscount(
          quoteId = quoteId,
          companyId = companyId,
          discountType = request.discountType,
          value = request.value
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Quote>(false, "Quote not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quote discount applied successfully", data = updated))
      }
    }

    // DELETE /quotes/{id} - Delete quote
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val quoteId = (call.parameters["id"] ?: throw IllegalArgumentException("Quote ID is required")).toUuid()

        val deleted = quoteRepository.deleteQuote(quoteId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Quote deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Quote not found"))
        }
      }
    }

    // POST /quotes/{id}/lists - Add list group to quote (e.g. "Salon Grubu")
    post("/{id}/lists") {
      call.authenticate<QuoteList>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val quoteId = (call.parameters["id"] ?: throw IllegalArgumentException("Quote ID is required")).toUuid()
        val request = call.receive<CreateQuoteListRequest>()

        val createdList = quoteRepository.createQuoteList(
          quoteId = quoteId,
          companyId = companyId,
          title = request.title,
          sortOrder = request.sortOrder
        )

        if (createdList == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<QuoteList>(false, "Quote not found"))
        }

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Quote list created successfully", data = createdList))
      }
    }

    // PUT /quotes/lists/{listId} - Update quote list
    put("/lists/{listId}") {
      call.authenticate<QuoteList>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val listId = (call.parameters["listId"] ?: throw IllegalArgumentException("List ID is required")).toUuid()
        val request = call.receive<UpdateQuoteListRequest>()

        val updatedList = quoteRepository.updateQuoteList(
          listId = listId,
          companyId = companyId,
          title = request.title,
          sortOrder = request.sortOrder
        )

        if (updatedList == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<QuoteList>(false, "Quote list not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quote list updated successfully", data = updatedList))
      }
    }

    // DELETE /quotes/lists/{listId} - Delete quote list
    delete("/lists/{listId}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val listId = (call.parameters["listId"] ?: throw IllegalArgumentException("List ID is required")).toUuid()

        val deleted = quoteRepository.deleteQuoteList(listId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Quote list deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Quote list not found"))
        }
      }
    }

    // POST /quotes/lists/{listId}/items - Add item / product to list
    post("/lists/{listId}/items") {
      call.authenticate<QuoteItem>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val listId = (call.parameters["listId"] ?: throw IllegalArgumentException("List ID is required")).toUuid()
        val request = call.receive<AddQuoteItemRequest>()

        val createdItem = quoteRepository.addQuoteItem(
          listId = listId,
          companyId = companyId,
          productId = request.productId?.toUuid(),
          productName = request.productName,
          productCode = request.productCode,
          quantity = request.quantity,
          unitPrice = request.unitPrice,
          discountAmount = request.discountAmount
        )

        if (createdItem == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<QuoteItem>(false, "Quote list not found"))
        }

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Item added to quote list successfully", data = createdItem))
      }
    }

    // PUT /quotes/items/{itemId} - Update quote item (unitPrice, quantity, discount)
    put("/items/{itemId}") {
      call.authenticate<QuoteItem>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val itemId = (call.parameters["itemId"] ?: throw IllegalArgumentException("Item ID is required")).toUuid()
        val request = call.receive<UpdateQuoteItemRequest>()

        val updatedItem = quoteRepository.updateQuoteItem(
          itemId = itemId,
          companyId = companyId,
          productName = request.productName,
          productCode = request.productCode,
          quantity = request.quantity,
          unitPrice = request.unitPrice,
          discountAmount = request.discountAmount
        )

        if (updatedItem == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<QuoteItem>(false, "Quote item not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Quote item updated successfully", data = updatedItem))
      }
    }

    // DELETE /quotes/items/{itemId} - Remove item from quote
    delete("/items/{itemId}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val itemId = (call.parameters["itemId"] ?: throw IllegalArgumentException("Item ID is required")).toUuid()

        val deleted = quoteRepository.deleteQuoteItem(itemId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Quote item deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Quote item not found"))
        }
      }
    }
  }
}

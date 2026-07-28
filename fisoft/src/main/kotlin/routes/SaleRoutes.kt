package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.SaleRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.request.AddPaymentLogRequest
import com.ilyasdemirkiran.types.request.CreateSaleRequest
import com.ilyasdemirkiran.types.request.UpdateSaleRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.types.sales.Sale
import com.ilyasdemirkiran.types.sales.SaleLog
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.Instant

fun Route.saleRoutes(saleRepository: SaleRepository, userRepository: UserRepository) {
  route("/sales") {

    // GET /sales - List all sales for company (optional ?customerId=...)
    get {
      call.authenticate<List<Sale>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val customerIdParam = call.request.queryParameters["customerId"]

        val sales = if (customerIdParam != null) {
          saleRepository.getSalesByCustomerId(customerIdParam.toUuid(), companyId)
        } else {
          saleRepository.getSalesByCompanyId(companyId)
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Sales retrieved successfully", data = sales))
      }
    }

    // POST /sales - Create sale
    post {
      call.authenticate<Sale>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateSaleRequest>()

        val sale = saleRepository.createSale(
          companyId = companyId,
          customerId = request.customerId.toUuid(),
          createdByUserId = auth.user.id,
          createdByUserName = "${auth.user.name} ${auth.user.surname}",
          totalAmount = request.totalAmount,
          currency = request.currency,
          status = request.status,
          description = request.description
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Sale created successfully", data = sale))
      }
    }

    // GET /sales/logs/monthly - Get payment logs filtered by date range (e.g. for monthly logs screen)
    get("/logs/monthly") {
      call.authenticate<List<SaleLog>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val startDateStr = call.request.queryParameters["startDate"]
        val endDateStr = call.request.queryParameters["endDate"]

        val startDate = if (startDateStr != null) Instant.parse(startDateStr) else Instant.EPOCH
        val endDate = if (endDateStr != null) Instant.parse(endDateStr) else Instant.now()

        val logs = saleRepository.getLogsByDateRange(companyId, startDate, endDate)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Sale logs retrieved successfully", data = logs))
      }
    }

    // GET /sales/{id} - Get sale by ID
    get("/{id}") {
      call.authenticate<Sale>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Sale ID is required")
        val saleId = idStr.toUuid()

        val sale = saleRepository.getSaleById(saleId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Sale>(false, "Sale not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Sale retrieved successfully", data = sale))
      }
    }

    // PUT /sales/{id} - Update sale
    put("/{id}") {
      call.authenticate<Sale>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Sale ID is required")
        val saleId = idStr.toUuid()

        val request = call.receive<UpdateSaleRequest>()
        val updated = saleRepository.updateSale(
          id = saleId,
          companyId = companyId,
          totalAmount = request.totalAmount,
          currency = request.currency,
          status = request.status,
          description = request.description
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Sale>(false, "Sale not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Sale updated successfully", data = updated))
      }
    }

    // POST /sales/{id}/logs - Add payment log to sale
    post("/{id}/logs") {
      call.authenticate<SaleLog>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Sale ID is required")
        val saleId = idStr.toUuid()

        val sale = saleRepository.getSaleById(saleId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<SaleLog>(false, "Sale not found"))

        val request = call.receive<AddPaymentLogRequest>()
        val log = saleRepository.addPaymentLog(
          saleId = sale.id,
          companyId = companyId,
          customerId = sale.customerId,
          createdByUserId = auth.user.id,
          createdByUserName = "${auth.user.name} ${auth.user.surname}",
          amount = request.amount,
          currency = request.currency,
          paymentType = request.paymentType,
          description = request.description,
          paymentDate = request.paymentDate ?: Instant.now()
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Payment log added successfully", data = log))
      }
    }

    // GET /sales/{id}/logs - Get all payment logs for a sale
    get("/{id}/logs") {
      call.authenticate<List<SaleLog>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Sale ID is required")
        val saleId = idStr.toUuid()

        val logs = saleRepository.getLogsBySaleId(saleId, companyId)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Sale logs retrieved successfully", data = logs))
      }
    }
  }
}

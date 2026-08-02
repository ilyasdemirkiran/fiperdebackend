package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.AccountRepository
import com.ilyasdemirkiran.repository.SaleRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.request.AddPaymentLogRequest
import com.ilyasdemirkiran.types.request.CreateSaleRequest
import com.ilyasdemirkiran.types.request.UpdatePaymentLogRequest
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
import java.time.LocalDate
import java.time.ZoneOffset

private fun parseDateToInstant(dateStr: String?, isEnd: Boolean): Instant {
  if (dateStr.isNullOrBlank()) {
    return if (isEnd) Instant.now() else Instant.EPOCH
  }

  return try {
    // 1. DENE: ISO-8601 Instant format (örn: 2026-06-30T00:00:00Z)
    Instant.parse(dateStr)
  } catch (e: Exception) {
    try {
      // 2. DENE: YYYY-MM-DD format (örn: 2026-06-30)
      val localDate = LocalDate.parse(dateStr)
      if (isEnd) {
        localDate.atTime(23, 59, 59, 999_999_999).toInstant(ZoneOffset.UTC)
      } else {
        localDate.atStartOfDay().toInstant(ZoneOffset.UTC)
      }
    } catch (e2: Exception) {
      if (isEnd) Instant.now() else Instant.EPOCH
    }
  }
}

fun Route.saleRoutes(
  saleRepository: SaleRepository,
  userRepository: UserRepository,
  accountRepository: AccountRepository = AccountRepository()
) {
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

        val startDate = parseDateToInstant(startDateStr, isEnd = false)
        val endDate = parseDateToInstant(endDateStr, isEnd = true)

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
        val accountUuid = request.accountId?.takeIf { it.isNotBlank() }?.toUuid()

        if (accountUuid != null) {
          val account = accountRepository.getAccountById(accountUuid, companyId)
            ?: return@authenticate call.respond(
              HttpStatusCode.NotFound,
              ServerResponse<SaleLog>(false, "Account not found")
            )

          if (!account.currency.equals(request.currency, ignoreCase = true)) {
            return@authenticate call.respond(
              HttpStatusCode.BadRequest,
              ServerResponse<SaleLog>(
                false,
                "Currency mismatch",
                error = "Account currency (${account.currency}) does not match payment currency (${request.currency})"
              )
            )
          }
        }

        val log = saleRepository.addPaymentLog(
          saleId = sale.id,
          companyId = companyId,
          customerId = sale.customerId,
          createdByUserId = auth.user.id,
          createdByUserName = "${auth.user.name} ${auth.user.surname}",
          amount = request.amount,
          currency = request.currency,
          paymentType = request.paymentType,
          accountId = accountUuid,
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

    // PUT /sales/logs/{logId} - Update payment log
    put("/logs/{logId}") {
      call.authenticate<SaleLog>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val logId = (call.parameters["logId"] ?: throw IllegalArgumentException("Log ID is required")).toUuid()
        val request = call.receive<UpdatePaymentLogRequest>()

        val existingLog = saleRepository.getLogById(logId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<SaleLog>(false, "Payment log not found"))

        val targetAccountId = request.accountId?.takeIf { it.isNotBlank() }?.toUuid()
        val finalAccountId = targetAccountId ?: existingLog.accountId
        val finalCurrency = request.currency ?: existingLog.currency

        if (finalAccountId != null) {
          val account = accountRepository.getAccountById(finalAccountId, companyId)
            ?: return@authenticate call.respond(
              HttpStatusCode.NotFound,
              ServerResponse<SaleLog>(false, "Account not found")
            )

          if (!account.currency.equals(finalCurrency, ignoreCase = true)) {
            return@authenticate call.respond(
              HttpStatusCode.BadRequest,
              ServerResponse<SaleLog>(
                false,
                "Currency mismatch",
                error = "Account currency (${account.currency}) does not match payment currency ($finalCurrency)"
              )
            )
          }
        }

        val updatedLog = saleRepository.updatePaymentLog(
          logId = logId,
          companyId = companyId,
          amount = request.amount,
          currency = request.currency,
          paymentType = request.paymentType,
          accountId = targetAccountId,
          description = request.description,
          paymentDate = request.paymentDate
        )

        if (updatedLog == null) {
          call.respond(HttpStatusCode.NotFound, ServerResponse<SaleLog>(false, "Payment log not found"))
        } else {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Payment log updated successfully", data = updatedLog))
        }
      }
    }

    // DELETE /sales/logs/{logId} - Delete payment log
    delete("/logs/{logId}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val logId = (call.parameters["logId"] ?: throw IllegalArgumentException("Log ID is required")).toUuid()

        val deleted = saleRepository.deletePaymentLog(logId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Payment log deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Payment log not found"))
        }
      }
    }
  }
}

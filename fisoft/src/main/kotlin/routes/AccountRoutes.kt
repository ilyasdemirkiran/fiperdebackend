package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.AccountRepository
import com.ilyasdemirkiran.repository.SaleRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.accounts.Account
import com.ilyasdemirkiran.types.request.CreateAccountRequest
import com.ilyasdemirkiran.types.request.UpdateAccountRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.types.sales.SaleLog
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.accountRoutes(
  accountRepository: AccountRepository = AccountRepository(),
  saleRepository: SaleRepository = SaleRepository(),
  userRepository: UserRepository
) {
  route("/accounts") {

    // GET /accounts - List all accounts for user's company
    get {
      call.authenticate<List<Account>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val accounts = accountRepository.getAccountsByCompanyId(companyId)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Accounts retrieved successfully", data = accounts))
      }
    }

    // POST /accounts - Create an account
    post {
      call.authenticate<Account>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateAccountRequest>()
        val account = accountRepository.createAccount(
          companyId = companyId,
          name = request.name,
          accountType = request.accountType,
          accountNumber = request.accountNumber,
          bankName = request.bankName,
          iban = request.iban,
          currency = request.currency,
          description = request.description
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Account created successfully", data = account))
      }
    }

    // GET /accounts/{id} - Get account by ID
    get("/{id}") {
      call.authenticate<Account>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Account ID is required")
        val accountId = idStr.toUuid()

        val account = accountRepository.getAccountById(accountId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Account>(false, "Account not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Account retrieved successfully", data = account))
      }
    }

    // PUT /accounts/{id} - Update account
    put("/{id}") {
      call.authenticate<Account>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Account ID is required")
        val accountId = idStr.toUuid()

        val request = call.receive<UpdateAccountRequest>()
        val updated = accountRepository.updateAccount(
          id = accountId,
          companyId = companyId,
          name = request.name,
          accountType = request.accountType,
          accountNumber = request.accountNumber,
          bankName = request.bankName,
          iban = request.iban,
          currency = request.currency,
          description = request.description
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Account>(false, "Account not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Account updated successfully", data = updated))
      }
    }

    // DELETE /accounts/{id} - Delete account
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Account ID is required")
        val accountId = idStr.toUuid()

        val deleted = accountRepository.deleteAccount(accountId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Account deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Account not found"))
        }
      }
    }

    // GET /accounts/{id}/logs - Get logs belonging to an account with optional year/month query params
    // Example: GET /accounts/{id}/logs (all logs)
    // Example: GET /accounts/{id}/logs?year=2026 (logs for year 2026)
    // Example: GET /accounts/{id}/logs?year=2026&month=8 (logs for August 2026)
    get("/{id}/logs") {
      call.authenticate<List<SaleLog>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Account ID is required")
        val accountId = idStr.toUuid()

        val account = accountRepository.getAccountById(accountId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<List<SaleLog>>(false, "Account not found"))

        val yearParam = call.request.queryParameters["year"]?.toIntOrNull()
        val monthParam = call.request.queryParameters["month"]?.toIntOrNull()

        val logs = when {
          yearParam != null && monthParam != null -> {
            saleRepository.getLogsByAccountIdAndMonth(account.id, companyId, yearParam, monthParam)
          }
          yearParam != null -> {
            saleRepository.getLogsByAccountIdAndYear(account.id, companyId, yearParam)
          }
          else -> {
            saleRepository.getLogsByAccountId(account.id, companyId)
          }
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Account logs retrieved successfully", data = logs))
      }
    }
  }
}

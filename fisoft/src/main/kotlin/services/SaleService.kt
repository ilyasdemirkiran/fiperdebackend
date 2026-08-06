package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.SaleRepository
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.sales.PaymentLog
import com.ilyasdemirkiran.types.sales.Sale
import io.ktor.http.*
import java.time.Instant
import java.util.UUID

class SaleService(
    private val repo: SaleRepository = SaleRepository()
) {
    private fun assertAdmin(role: UserRole) {
        if (role != UserRole.admin && role != UserRole.sudo) {
            throw AppError(HttpStatusCode.Forbidden, "Only admin users can perform this operation", "FORBIDDEN")
        }
    }

    suspend fun createSale(companyId: String, userId: String, userName: String, role: UserRole, customerId: String, totalAmount: Money, currency: String = "TRY", description: String? = null, logs: List<PaymentLog> = emptyList()): Sale {
        assertAdmin(role)
        val totalPaidAmount = logs.fold(Money.ZERO) { acc, log -> acc + log.amount }
        val status = if (totalPaidAmount >= totalAmount) "completed" else "pending"

        val sale = Sale(
            customerId = customerId,
            createdByUserId = userId,
            createdByUserName = userName,
            totalAmount = totalAmount,
            totalPaidAmount = totalPaidAmount,
            currency = currency,
            status = status,
            description = description,
            createdAt = Instant.now().toString(),
            logs = logs
        )

        return repo.create(companyId, sale)
    }

    suspend fun getSale(companyId: String, saleId: String): Sale {
        return repo.findById(companyId, saleId)
            ?: throw AppError(HttpStatusCode.NotFound, "Sale not found", "SALE_NOT_FOUND")
    }

    suspend fun listSalesByCustomer(companyId: String, customerId: String): List<Sale> {
        return repo.findByCustomerId(companyId, customerId)
    }

    suspend fun deleteSale(companyId: String, saleId: String, role: UserRole) {
        assertAdmin(role)
        if (!repo.delete(companyId, saleId)) {
            throw AppError(HttpStatusCode.NotFound, "Sale not found", "SALE_NOT_FOUND")
        }
    }

    suspend fun addPaymentLog(companyId: String, saleId: String, userId: String, userName: String, role: UserRole, amount: Money, currency: String = "TRY", paymentType: String = "cash", description: String? = null): Sale {
        assertAdmin(role)
        val sale = getSale(companyId, saleId)

        val log = PaymentLog(
            _id = UUID.randomUUID().toString(),
            saleId = saleId,
            customerId = sale.customerId,
            createdByUserId = userId,
            createdByUserName = userName,
            amount = amount,
            currency = currency,
            paymentType = paymentType,
            description = description,
            createdAt = Instant.now().toString()
        )

        return repo.addPaymentLog(companyId, saleId, log)
            ?: throw AppError(HttpStatusCode.InternalServerError, "Failed to add payment log")
    }
}

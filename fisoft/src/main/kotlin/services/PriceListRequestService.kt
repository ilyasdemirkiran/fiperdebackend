package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.PriceListRequestRepository
import com.ilyasdemirkiran.types.vendors.PriceListRequest
import io.ktor.http.*
import java.time.Instant

class PriceListRequestService(
    private val repo: PriceListRequestRepository = PriceListRequestRepository()
) {
    suspend fun createRequest(companyId: String, companyName: String, vendorId: String, vendorName: String, message: String? = null): PriceListRequest {
        val req = PriceListRequest(
            companyId = companyId,
            companyName = companyName,
            vendorId = vendorId,
            vendorName = vendorName,
            status = "pending",
            message = message,
            createdAt = Instant.now().toString()
        )
        return repo.create(req)
    }

    suspend fun listAllRequests(): List<PriceListRequest> {
        return repo.findAll()
    }

    suspend fun updateRequestStatus(id: String, status: String) {
        if (!repo.updateStatus(id, status)) {
            throw AppError(HttpStatusCode.NotFound, "Request not found", "NOT_FOUND")
        }
    }
}

package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CustomerImageLabelRepository
import com.ilyasdemirkiran.types.customers.CustomerImageLabel
import io.ktor.http.*

class CustomerImageLabelService(
    private val repo: CustomerImageLabelRepository = CustomerImageLabelRepository()
) {
    suspend fun createLabel(companyId: String, name: String): CustomerImageLabel {
        return repo.create(companyId, name)
    }

    suspend fun getLabel(companyId: String, id: String): CustomerImageLabel {
        return repo.findById(companyId, id)
            ?: throw AppError(HttpStatusCode.NotFound, "Label not found", "LABEL_NOT_FOUND")
    }

    suspend fun listLabels(companyId: String): List<CustomerImageLabel> {
        return repo.findAll(companyId)
    }

    suspend fun updateLabel(companyId: String, id: String, name: String): CustomerImageLabel {
        return repo.update(companyId, id, name)
            ?: throw AppError(HttpStatusCode.NotFound, "Label not found", "LABEL_NOT_FOUND")
    }

    suspend fun deleteLabel(companyId: String, id: String) {
        if (!repo.delete(companyId, id)) {
            throw AppError(HttpStatusCode.NotFound, "Label not found", "LABEL_NOT_FOUND")
        }
    }
}

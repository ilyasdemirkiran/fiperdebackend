package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CustomerImageRepository
import com.ilyasdemirkiran.types.customers.CustomerImage
import io.ktor.http.*
import java.time.Instant

class CustomerImageService(
    private val repo: CustomerImageRepository = CustomerImageRepository()
) {
    suspend fun uploadImage(
        companyId: String,
        customerId: String?,
        filename: String,
        data: ByteArray,
        mimeType: String,
        labels: List<String> = emptyList()
    ): CustomerImage {
        val fileId = repo.uploadToGridFS(companyId, filename, data, mimeType)

        val image = CustomerImage(
            customerId = customerId,
            originalFileId = fileId,
            labels = labels,
            uploadedAt = Instant.now().toString()
        )

        return repo.create(companyId, image, fileId)
    }

    suspend fun listAllImages(companyId: String): List<CustomerImage> {
        return repo.findAll(companyId)
    }

    suspend fun getImagesByLabels(companyId: String, labelIds: List<String>): List<CustomerImage> {
        return repo.findByLabels(companyId, labelIds)
    }

    suspend fun getImageMetadata(companyId: String, imageId: String): CustomerImage {
        return repo.findById(companyId, imageId)
            ?: throw AppError(HttpStatusCode.NotFound, "Image not found", "IMAGE_NOT_FOUND")
    }

    suspend fun downloadImage(companyId: String, imageId: String): Pair<ByteArray, String> {
        val image = getImageMetadata(companyId, imageId)
        val fileId = image.originalFileId ?: throw AppError(HttpStatusCode.NotFound, "Image file not found", "IMAGE_NOT_FOUND")
        return repo.downloadFromGridFS(companyId, fileId)
    }

    suspend fun getCustomerImages(companyId: String, customerId: String): List<CustomerImage> {
        return repo.findByCustomerId(companyId, customerId)
    }

    suspend fun updateImage(companyId: String, imageId: String, labels: List<String>): CustomerImage {
        return repo.updateLabels(companyId, imageId, labels)
            ?: throw AppError(HttpStatusCode.NotFound, "Image not found", "IMAGE_NOT_FOUND")
    }

    suspend fun deleteImage(companyId: String, imageId: String) {
        if (!repo.delete(companyId, imageId)) {
            throw AppError(HttpStatusCode.NotFound, "Image not found", "IMAGE_NOT_FOUND")
        }
    }
}

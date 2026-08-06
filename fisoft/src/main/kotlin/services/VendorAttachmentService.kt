package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.VendorAttachmentRepository
import com.ilyasdemirkiran.repository.VendorRepository
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.vendors.VendorDocument
import io.ktor.http.*
import java.time.Instant

class VendorAttachmentService(
    private val repo: VendorAttachmentRepository = VendorAttachmentRepository(),
    private val vendorRepo: VendorRepository = VendorRepository()
) {
    private fun assertSudo(role: UserRole) {
        if (role != UserRole.sudo) {
            throw AppError(HttpStatusCode.Forbidden, "Only sudo users can perform this operation", "FORBIDDEN")
        }
    }

    suspend fun listAttachmentsByVendor(vendorId: String): List<VendorDocument> {
        return repo.findByVendorId(vendorId)
    }

    suspend fun getAttachmentMetadata(attachmentId: String): VendorDocument {
        return repo.findById(attachmentId)
            ?: throw AppError(HttpStatusCode.NotFound, "Attachment not found", "ATTACHMENT_NOT_FOUND")
    }

    suspend fun getAttachmentFile(attachmentId: String): Triple<ByteArray, String, String> {
        val doc = getAttachmentMetadata(attachmentId)
        val fileId = doc.fileId
            ?: throw AppError(HttpStatusCode.NotFound, "Attachment file data not found", "ATTACHMENT_NOT_FOUND")
        val (data, mimeType) = repo.downloadFromGridFS(fileId)
        val filename = doc.fileName ?: "attachment.pdf"
        return Triple(data, mimeType, filename)
    }

    suspend fun uploadAttachment(
        role: UserRole,
        vendorId: String,
        title: String,
        filename: String,
        data: ByteArray,
        mimeType: String
    ): VendorDocument {
        assertSudo(role)

        if (vendorRepo.findById(vendorId) == null) {
            throw AppError(HttpStatusCode.NotFound, "Vendor not found", "VENDOR_NOT_FOUND")
        }

        val fileId = repo.uploadToGridFS(filename, data, mimeType)

        val doc = VendorDocument(
            vendorId = vendorId,
            title = title,
            fileId = fileId,
            fileName = filename,
            fileType = mimeType,
            uploadedAt = Instant.now().toString()
        )

        return repo.create(doc)
    }

    suspend fun updateAttachment(role: UserRole, attachmentId: String, title: String?, description: String?): VendorDocument {
        assertSudo(role)
        return repo.update(attachmentId, title, description)
            ?: throw AppError(HttpStatusCode.NotFound, "Attachment not found", "ATTACHMENT_NOT_FOUND")
    }

    suspend fun deleteAttachment(role: UserRole, attachmentId: String) {
        assertSudo(role)
        if (!repo.delete(attachmentId)) {
            throw AppError(HttpStatusCode.NotFound, "Attachment not found", "ATTACHMENT_NOT_FOUND")
        }
    }
}

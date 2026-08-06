package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.VendorAttachmentService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class UpdateVendorAttachmentReq(
    val title: String? = null,
    val description: String? = null
)

fun Route.vendorAttachmentRoutes() {
    val attachmentService = VendorAttachmentService()

    route("/api/vendors/{vendorId}/attachments") {
        // GET /api/vendors/{vendorId}/attachments - List attachments for vendor
        get {
            call.authenticateUser()
            val vendorId = call.parameters["vendorId"] ?: ""
            val attachments = attachmentService.listAttachmentsByVendor(vendorId)
            call.respond(HttpStatusCode.OK, successResponse(attachments))
        }

        // POST /api/vendors/{vendorId}/attachments - Upload attachment PDF (sudo only)
        post {
            call.authenticateUser()
            val user = call.currentUser
            val vendorId = call.parameters["vendorId"] ?: ""
            val multipart = call.receiveMultipart()
            var filename = "attachment.pdf"
            var mimeType = "application/pdf"
            var title = ""
            var bytes: ByteArray? = null

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        filename = part.originalFileName ?: "attachment.pdf"
                        mimeType = part.contentType?.toString() ?: "application/pdf"
                        bytes = part.streamProvider().readBytes()
                    }
                    is PartData.FormItem -> {
                        if (part.name == "title") {
                            title = part.value
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            if (bytes == null) {
                call.respond(HttpStatusCode.BadRequest, mapOf("success" to false, "error" to "No file provided"))
                return@post
            }
            if (title.isEmpty()) {
                title = filename
            }

            val doc = attachmentService.uploadAttachment(user.role, vendorId, title, filename, bytes!!, mimeType)
            call.respond(HttpStatusCode.Created, successResponse(doc))
        }

        // GET /api/vendors/{vendorId}/attachments/{attachmentId} - Get metadata
        get("/{attachmentId}") {
            call.authenticateUser()
            val attachmentId = call.parameters["attachmentId"] ?: ""
            val doc = attachmentService.getAttachmentMetadata(attachmentId)
            call.respond(HttpStatusCode.OK, successResponse(doc))
        }

        // GET /api/vendors/{vendorId}/attachments/{attachmentId}/preview - Inline preview
        get("/{attachmentId}/preview") {
            call.authenticateUser()
            val attachmentId = call.parameters["attachmentId"] ?: ""
            val (data, mimeType, filename) = attachmentService.getAttachmentFile(attachmentId)
            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Inline.withParameter(ContentDisposition.Parameters.FileName, filename).toString()
            )
            call.respondBytes(data, ContentType.parse(mimeType))
        }

        // GET /api/vendors/{vendorId}/attachments/{attachmentId}/download - Download file
        get("/{attachmentId}/download") {
            call.authenticateUser()
            val attachmentId = call.parameters["attachmentId"] ?: ""
            val (data, mimeType, filename) = attachmentService.getAttachmentFile(attachmentId)
            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(ContentDisposition.Parameters.FileName, filename).toString()
            )
            call.respondBytes(data, ContentType.parse(mimeType))
        }

        // PUT /api/vendors/{vendorId}/attachments/{attachmentId} - Update metadata
        put("/{attachmentId}") {
            call.authenticateUser()
            val user = call.currentUser
            val attachmentId = call.parameters["attachmentId"] ?: ""
            val req = call.receive<UpdateVendorAttachmentReq>()
            val updated = attachmentService.updateAttachment(user.role, attachmentId, req.title, req.description)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        // DELETE /api/vendors/{vendorId}/attachments/{attachmentId} - Delete attachment
        delete("/{attachmentId}") {
            call.authenticateUser()
            val user = call.currentUser
            val attachmentId = call.parameters["attachmentId"] ?: ""
            attachmentService.deleteAttachment(user.role, attachmentId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "Attachment deleted successfully")))
        }
    }
}

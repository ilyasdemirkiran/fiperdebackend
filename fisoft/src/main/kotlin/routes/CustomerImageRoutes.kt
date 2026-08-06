package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.services.CustomerImageService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class ByLabelsReq(val labelIds: List<String> = emptyList())

@Serializable
data class UpdateImageReq(val labels: List<String> = emptyList())

fun Route.customerImageRoutes() {
    val imageService = CustomerImageService()

    route("/api/customers/images") {
        // GET /api/customers/images - List all images across company
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val images = imageService.listAllImages(companyId)
            call.respond(HttpStatusCode.OK, successResponse(images))
        }

        // POST /api/customers/images/by-labels - Filter by labels
        post("/by-labels") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val req = call.receive<ByLabelsReq>()
            val images = imageService.getImagesByLabels(companyId, req.labelIds)
            call.respond(HttpStatusCode.OK, successResponse(images))
        }

        // GET /api/customers/images/{imageId} - Get image metadata
        get("/{imageId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val imageId = call.parameters["imageId"] ?: ""
            val image = imageService.getImageMetadata(companyId, imageId)
            call.respond(HttpStatusCode.OK, successResponse(image))
        }

        // GET /api/customers/images/{imageId}/download - Raw image download
        get("/{imageId}/download") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val imageId = call.parameters["imageId"] ?: ""
            val (bytes, mimeType) = imageService.downloadImage(companyId, imageId)
            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(ContentDisposition.Parameters.FileName, "image.jpg").toString()
            )
            call.respondBytes(bytes, ContentType.parse(mimeType))
        }

        // POST /api/customers/images - Upload image without customerId
        post {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val multipart = call.receiveMultipart()
            var filename = "image.jpg"
            var mimeType = "image/jpeg"
            var bytes: ByteArray? = null
            var labels: List<String> = emptyList()

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        filename = part.originalFileName ?: "image.jpg"
                        mimeType = part.contentType?.toString() ?: "image/jpeg"
                        bytes = part.streamProvider().readBytes()
                    }
                    is PartData.FormItem -> {
                        if (part.name == "labels") {
                            labels = part.value.split(",").map { it.trim() }.filter { it.isNotEmpty() }
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

            val image = imageService.uploadImage(companyId, null, filename, bytes!!, mimeType, labels)
            call.respond(HttpStatusCode.Created, successResponse(image))
        }

        // PUT /api/customers/images/{imageId} - Update labels metadata
        put("/{imageId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val imageId = call.parameters["imageId"] ?: ""
            val req = call.receive<UpdateImageReq>()
            val updated = imageService.updateImage(companyId, imageId, req.labels)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        // DELETE /api/customers/images/{imageId} - Delete image
        delete("/{imageId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val imageId = call.parameters["imageId"] ?: ""
            imageService.deleteImage(companyId, imageId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "Image deleted successfully")))
        }
    }
}

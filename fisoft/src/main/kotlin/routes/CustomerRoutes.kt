package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.CustomerImageService
import com.ilyasdemirkiran.services.CustomerNoteService
import com.ilyasdemirkiran.services.CustomerService
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.utils.paginatedResponse
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateCustomerReq(
    val name: String,
    val surname: String,
    val phone: String? = null,
    val city: String? = null,
    val district: String? = null,
    val address: String? = null
)

@Serializable
data class CreateNoteReq(val note: String)

fun Route.customerRoutes() {
    val customerService = CustomerService()
    val noteService = CustomerNoteService()
    val imageService = CustomerImageService()

    route("/api/customers") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 20
            val status = call.request.queryParameters["status"]
            val search = call.request.queryParameters["search"]

            val (customers, total) = customerService.listCustomers(companyId, page, limit, status, search)
            call.respond(HttpStatusCode.OK, paginatedResponse(customers, page, limit, total))
        }

        get("/all") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val status = if (user.role == UserRole.user) "active" else null
            val customers = customerService.getAllCustomers(companyId, status)
            call.respond(HttpStatusCode.OK, successResponse(customers))
        }

        post {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val req = call.receive<CreateCustomerReq>()
            val customer = customerService.createCustomer(companyId, req.name, req.surname, req.phone, req.city, req.district, req.address)
            call.respond(HttpStatusCode.Created, successResponse(customer))
        }

        get("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val customer = customerService.getCustomer(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(customer))
        }

        put("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<CreateCustomerReq>()
            val updated = customerService.updateCustomer(companyId, id, req.name, req.surname, req.phone, req.city, req.district, req.address)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{id}") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            customerService.deleteCustomer(companyId, id, user.role)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        // Customer Notes
        get("/{id}/notes") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val notes = noteService.getCustomerNotes(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(notes))
        }

        post("/{id}/notes") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val req = call.receive<CreateNoteReq>()
            val note = noteService.createNote(companyId, id, user._id, req.note)
            call.respond(HttpStatusCode.Created, successResponse(note))
        }

        put("/{id}/notes/{noteId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val noteId = call.parameters["noteId"] ?: ""
            val req = call.receive<CreateNoteReq>()
            val updated = noteService.updateNote(companyId, noteId, req.note)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{id}/notes/{noteId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val noteId = call.parameters["noteId"] ?: ""
            noteService.deleteNote(companyId, noteId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "Customer note deleted successfully")))
        }

        // Customer Images by Customer ID
        get("/{id}/images") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val images = imageService.getCustomerImages(companyId, id)
            call.respond(HttpStatusCode.OK, successResponse(images))
        }

        post("/{id}/images") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val customerId = call.parameters["id"] ?: ""
            val multipart = call.receiveMultipart()
            var filename = "image.jpg"
            var mimeType = "image/jpeg"
            var bytes: ByteArray? = null
            var labels: List<String> = emptyList()

            multipart.forEachPart { part ->
                when (part) {
                    is io.ktor.http.content.PartData.FileItem -> {
                        filename = part.originalFileName ?: "image.jpg"
                        mimeType = part.contentType?.toString() ?: "image/jpeg"
                        bytes = part.streamProvider().readBytes()
                    }
                    is io.ktor.http.content.PartData.FormItem -> {
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

            val image = imageService.uploadImage(companyId, customerId, filename, bytes!!, mimeType, labels)
            call.respond(HttpStatusCode.Created, successResponse(image))
        }
    }
}

package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.CompanyService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateCompanyRequest(val name: String)

@Serializable
data class InviteUserRequest(val phone: String)

@Serializable
data class RespondInviteRequest(val accept: Boolean)

@Serializable
data class UpdateCompanyNameRequest(val name: String)

fun Route.companyRoutes() {
    val companyService = CompanyService()

    route("/api/companies") {
        // GET /api/companies/{id}/logo/{type} - Public endpoint
        get("/{id}/logo/{type}") {
            val companyId = call.parameters["id"] ?: ""
            val type = call.parameters["type"] ?: "original"

            if (type != "mini" && type != "original") {
                call.respond(HttpStatusCode.BadRequest, mapOf("success" to false, "error" to "Invalid logo type"))
                return@get
            }

            val (bytes, mimeType) = companyService.getCompanyLogo(companyId, type)
            call.response.header(HttpHeaders.CacheControl, "public, max-age=604800")
            call.respondBytes(bytes, ContentType.parse(mimeType))
        }

        get("/my-company") {
            call.authenticateUser()
            val user = call.currentUser
            val company = companyService.getMyCompany(user._id)
            call.respond(HttpStatusCode.OK, successResponse(company))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val req = call.receive<CreateCompanyRequest>()
            val company = companyService.createCompany(user._id, req.name)
            call.respond(HttpStatusCode.Created, successResponse(company))
        }

        post("/invite") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = user.companyId ?: throw AppError(HttpStatusCode.BadRequest, "Bir şirkete üye değilsiniz")
            val req = call.receive<InviteUserRequest>()
            val invite = companyService.inviteUser(user._id, companyId, req.phone)
            call.respond(HttpStatusCode.Created, successResponse(invite))
        }

        get("/invites") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = user.companyId ?: throw AppError(HttpStatusCode.BadRequest, "Bir şirkete üye değilsiniz")
            val invites = companyService.getCompanyInvites(user._id, companyId)
            call.respond(HttpStatusCode.OK, successResponse(invites))
        }

        get("/my-invites") {
            call.authenticateUser()
            val user = call.currentUser
            val invites = companyService.getMyInvites(user._id)
            call.respond(HttpStatusCode.OK, successResponse(invites))
        }

        post("/invites/{id}/respond") {
            call.authenticateUser()
            val user = call.currentUser
            val inviteId = call.parameters["id"] ?: ""
            val req = call.receive<RespondInviteRequest>()
            companyService.respondToInvite(user._id, inviteId, req.accept)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        delete("/invites/{inviteId}") {
            call.authenticateUser()
            val user = call.currentUser
            val inviteId = call.parameters["inviteId"] ?: ""
            companyService.deleteInvite(user._id, inviteId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        post("/leave") {
            call.authenticateUser()
            val user = call.currentUser
            companyService.leaveCompany(user._id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        put("/name") {
            call.authenticateUser()
            val user = call.currentUser
            val req = call.receive<UpdateCompanyNameRequest>()
            val company = companyService.updateCompanyName(user._id, req.name)
            call.respond(HttpStatusCode.OK, successResponse(company))
        }

        delete("/me") {
            call.authenticateUser()
            val user = call.currentUser
            companyService.deleteCompany(user._id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "Company deleted successfully")))
        }

        get("/{id}/users") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val users = companyService.getCompanyUsers(user._id, companyId)
            call.respond(HttpStatusCode.OK, successResponse(users))
        }

        post("/{id}/users/{userId}/promote") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val targetUserId = call.parameters["userId"] ?: ""
            companyService.promoteUser(user._id, companyId, targetUserId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        post("/{id}/users/{userId}/demote") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val targetUserId = call.parameters["userId"] ?: ""
            companyService.demoteUser(user._id, companyId, targetUserId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        delete("/{id}/users/{userId}") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val targetUserId = call.parameters["userId"] ?: ""
            companyService.removeUserFromCompany(user._id, companyId, targetUserId)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }

        // POST /api/companies/{id}/logo - Upload company logo
        post("/{id}/logo") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val multipart = call.receiveMultipart()

            var origBytes: ByteArray? = null
            var origMime: String? = null
            var miniBytes: ByteArray? = null
            var miniMime: String? = null

            multipart.forEachPart { part ->
                if (part is PartData.FileItem) {
                    val bytes = part.streamProvider().readBytes()
                    val mime = part.contentType?.toString() ?: "image/png"
                    if (part.name == "original") {
                        origBytes = bytes
                        origMime = mime
                    } else if (part.name == "mini") {
                        miniBytes = bytes
                        miniMime = mime
                    }
                }
                part.dispose()
            }

            if (origBytes == null && miniBytes == null) {
                call.respond(HttpStatusCode.BadRequest, mapOf("success" to false, "error" to "No logo files provided"))
                return@post
            }

            val updated = companyService.uploadCompanyLogo(user._id, companyId, origBytes, origMime, miniBytes, miniMime)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        // DELETE /api/companies/{id}/logo - Delete company logo
        delete("/{id}/logo") {
            call.authenticateUser()
            val user = call.currentUser
            val companyId = call.parameters["id"] ?: ""
            val updated = companyService.deleteCompanyLogo(user._id, companyId)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }
    }
}

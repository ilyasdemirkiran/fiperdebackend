package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.AuthService
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class RegisterRequest(
    val token: String,
    val name: String,
    val surname: String
)

@Serializable
data class IsRegisteredRequest(
    val phone: String
)

@Serializable
data class UpdateProfileRequest(
    val name: String,
    val surname: String
)

fun Route.authRoutes() {
    val authService = AuthService()

    route("/api/auth") {
        post("/register") {
            val req = call.receive<RegisterRequest>()
            val user = authService.registerUser(req.token, req.name, req.surname)
            call.respond(HttpStatusCode.Created, successResponse(user))
        }

        post("/is-registered") {
            val req = call.receive<IsRegisteredRequest>()
            val result = authService.isNumberRegistered(req.phone)
            call.respond(HttpStatusCode.OK, successResponse(result))
        }

        get("/users/{id}") {
            val id = call.parameters["id"] ?: ""
            val user = authService.getUserById(id)
            call.respond(HttpStatusCode.OK, successResponse(user))
        }

        put("/me") {
            call.authenticateUser()
            val user = call.currentUser
            val req = call.receive<UpdateProfileRequest>()
            val updated = authService.updateProfile(user._id, req.name, req.surname)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/me") {
            call.authenticateUser()
            val user = call.currentUser
            authService.deleteAccount(user._id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("message" to "Account deleted successfully")))
        }
    }
}

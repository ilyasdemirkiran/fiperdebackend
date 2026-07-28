package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.services.AuthService
import com.ilyasdemirkiran.types.PhoneNumbers
import com.ilyasdemirkiran.types.request.LoginRequest
import com.ilyasdemirkiran.types.response.LoginResponseData
import com.ilyasdemirkiran.types.response.ServerResponse
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.authRoutes(
  authService: AuthService = AuthService(),
  userRepository: UserRepository = UserRepository()
) {
  route("/auth") {
    post("/login") {
      try {
        val request = call.receive<LoginRequest>()
        val phoneNumber = PhoneNumbers.parse(request.phoneNumber)

        val session = authService.login(phoneNumber.value, request.password)
        val user = userRepository.getById(session.userId)
          ?: return@post call.respond(
            HttpStatusCode.NotFound,
            ServerResponse<LoginResponseData>(false, "User not found")
          )

        val loginData = LoginResponseData(
          token = session.token,
          user = user,
          session = session
        )

        call.respond(
          HttpStatusCode.OK,
          ServerResponse(
            success = true,
            message = "Login successful",
            data = loginData
          )
        )
      } catch (e: Exception) {
        call.respond(
          HttpStatusCode.Unauthorized,
          ServerResponse<LoginResponseData>(
            success = false,
            message = "Login failed",
            error = e.message ?: "Invalid credentials"
          )
        )
      }
    }

    post("/logout") {
      call.authenticate<Boolean>(requireCompany = false) { auth ->
        val success = authService.logout(auth.session.token)
        call.respond(
          HttpStatusCode.OK,
          ServerResponse(
            success = success,
            message = if (success) "Logout successful" else "Session not found",
            data = success
          )
        )
      }
    }

    get("/me") {
      call.authenticate<LoginResponseData>(requireCompany = false) { auth ->
        call.respond(
          HttpStatusCode.OK,
          ServerResponse(
            success = true,
            message = "Session validated successfully",
            data = LoginResponseData(
              token = auth.session.token,
              user = auth.user,
              session = auth.session
            )
          )
        )
      }
    }
  }
}

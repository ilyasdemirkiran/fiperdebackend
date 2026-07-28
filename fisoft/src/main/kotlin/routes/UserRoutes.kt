package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.services.AuthService
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.PhoneNumbers
import com.ilyasdemirkiran.types.request.CreateUserRequest
import com.ilyasdemirkiran.types.request.UpdateUserRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.userRoutes(userRepository: UserRepository, authService: AuthService = AuthService()) {
  get("/users") {
    call.respond(
      HttpStatusCode.OK,
      ServerResponse(
        success = true,
        message = "Users retrieved successfully",
        data = userRepository.getAll()
      )
    )
  }

  // Create User
  post("/users") {
    try {
      val request = call.receive<CreateUserRequest>()
      val phoneNumber = PhoneNumbers.parse(request.phoneNumber)

      val user = authService.registerUser(
        phoneNumber = phoneNumber.value,
        passwordRaw = request.password,
        name = request.name,
        surname = request.surname
      )

      val response = ServerResponse(
        success = true,
        message = "User created successfully",
        data = user
      )
      call.respond(HttpStatusCode.Created, response)
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to create user",
        error = e.message ?: "Unknown error"
      )
      call.respond(HttpStatusCode.BadRequest, response)
    }
  }

  // Update User
  put("/users/{id}") {
    try {
      val userIdStr = call.parameters["id"] ?: throw IllegalArgumentException("User ID is required")
      val request = call.receive<UpdateUserRequest>()

      val parsedPhoneNumber = request.phoneNumber?.let { PhoneNumbers.parse(it).value }
      val passwordHash = request.password?.let { authService.hashPassword(it) }

      val updatedUser = userRepository.update(
        userId = userIdStr.toUuid(),
        phoneNumber = parsedPhoneNumber,
        passwordHash = passwordHash,
        name = request.name,
        surname = request.surname
      )

      if (updatedUser == null) {
        val response = ServerResponse<FIUser>(
          success = false,
          message = "User not found",
          error = "User with ID $userIdStr does not exist"
        )
        call.respond(HttpStatusCode.NotFound, response)
      } else {
        val response = ServerResponse(
          success = true,
          message = "User updated successfully",
          data = updatedUser
        )
        call.respond(HttpStatusCode.OK, response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to update user",
        error = e.message ?: "Unknown error"
      )
      call.respond(HttpStatusCode.BadRequest, response)
    }
  }

  // Delete User
  delete("/users/{id}") {
    try {
      val userIdStr = call.parameters["id"] ?: throw IllegalArgumentException("User ID is required")

      val deleted = userRepository.delete(userIdStr.toUuid())

      if (deleted) {
        val response = ServerResponse(
          success = true,
          message = "User deleted successfully",
          data = "User $userIdStr has been deleted"
        )
        call.respond(HttpStatusCode.OK, response)
      } else {
        val response = ServerResponse<String>(
          success = false,
          message = "User not found",
          error = "User with ID $userIdStr does not exist"
        )
        call.respond(HttpStatusCode.NotFound, response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<String>(
        success = false,
        message = "Failed to delete user",
        error = e.message ?: "Unknown error"
      )
      call.respond(HttpStatusCode.BadRequest, response)
    }
  }

  // Get User by ID
  get("/users/{id}") {
    try {
      val userIdStr = call.parameters["id"] ?: throw IllegalArgumentException("User ID is required")

      val user = userRepository.getById(userIdStr.toUuid())

      if (user == null) {
        val response = ServerResponse<FIUser>(
          success = false,
          message = "User not found",
          error = "User with ID $userIdStr does not exist"
        )
        call.respond(HttpStatusCode.NotFound, response)
      } else {
        val response = ServerResponse(
          success = true,
          message = "User retrieved successfully",
          data = user
        )
        call.respond(HttpStatusCode.OK, response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to retrieve user",
        error = e.message ?: "Unknown error"
      )
      call.respond(HttpStatusCode.BadRequest, response)
    }
  }
}

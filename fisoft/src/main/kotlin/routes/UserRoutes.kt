package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.PhoneNumbers
import com.ilyasdemirkiran.types.request.CreateUserRequest
import com.ilyasdemirkiran.types.request.UpdateUserRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.userRoutes(userRepository: UserRepository) {
  get("/users") {
    call.respond(
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

      val user = userRepository.create(
        phoneNumber = phoneNumber.value,
        name = request.name,
        surname = request.surname
      )

      val response = ServerResponse(
        success = true,
        message = "User created successfully",
        data = user
      )
      call.respond(response)
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to create user",
        error = e.message ?: "Unknown error"
      )
      call.respond(response)
    }
  }

  // Update User
  put("/users/{id}") {
    try {
      val userIdStr = call.parameters["id"] ?: throw IllegalArgumentException("User ID is required")
      val request = call.receive<UpdateUserRequest>()

      val parsedPhoneNumber = request.phoneNumber?.let { PhoneNumbers.parse(it).value }

      val updatedUser = userRepository.update(
        userId = userIdStr.toUuid(),
        phoneNumber = parsedPhoneNumber,
        name = request.name,
        surname = request.surname
      )

      if (updatedUser == null) {
        val response = ServerResponse<FIUser>(
          success = false,
          message = "User not found",
          error = "User with ID $userIdStr does not exist"
        )
        call.respond(response)
      } else {
        val response = ServerResponse(
          success = true,
          message = "User updated successfully",
          data = updatedUser
        )
        call.respond(response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to update user",
        error = e.message ?: "Unknown error"
      )
      call.respond(response)
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
        call.respond(response)
      } else {
        val response = ServerResponse<String>(
          success = false,
          message = "User not found",
          error = "User with ID $userIdStr does not exist"
        )
        call.respond(response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<String>(
        success = false,
        message = "Failed to delete user",
        error = e.message ?: "Unknown error"
      )
      call.respond(response)
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
        call.respond(response)
      } else {
        val response = ServerResponse(
          success = true,
          message = "User retrieved successfully",
          data = user
        )
        call.respond(response)
      }
    } catch (e: Exception) {
      val response = ServerResponse<FIUser>(
        success = false,
        message = "Failed to retrieve user",
        error = e.message ?: "Unknown error"
      )
      call.respond(response)
    }
  }
}

package com.ilyasdemirkiran.middleware

import com.ilyasdemirkiran.types.UserRole
import io.ktor.http.*
import io.ktor.server.application.*

suspend fun ApplicationCall.authenticateManagement(): String {
    val user = authenticateUser()
    if (user.role != UserRole.sudo) {
        throw AppError(HttpStatusCode.Forbidden, "Unauthorized", "AUTH_ERROR")
    }
    return user._id
}

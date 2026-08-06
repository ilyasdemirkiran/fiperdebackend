package com.ilyasdemirkiran.middleware

import com.ilyasdemirkiran.config.FirebaseConfig
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.utils.Logger
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.util.AttributeKey

val UserAttributeKey = AttributeKey<FIUser>("UserAttributeKey")

val ApplicationCall.currentUser: FIUser
    get() = attributes.getOrNull(UserAttributeKey)
        ?: throw AppError(HttpStatusCode.Unauthorized, "User not authenticated", "AUTH_ERROR")

val ApplicationCall.currentCompanyId: String
    get() = currentUser.companyId
        ?: throw AppError(HttpStatusCode.BadRequest, "Kullanıcının şirketi bulunamadı", "NO_COMPANY")

suspend fun ApplicationCall.authenticateUser(): FIUser {
    val authHeader = request.header(HttpHeaders.Authorization)
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        throw AppError(HttpStatusCode.Unauthorized, "Missing or invalid Authorization header", "AUTH_ERROR")
    }

    val token = authHeader.substring(7)
    val decodedToken = FirebaseConfig.verifyToken(token)
    val userId = decodedToken.uid

    val userRepo = UserRepository()
    val user = userRepo.findById(userId)
        ?: throw AppError(HttpStatusCode.Unauthorized, "User not found in database", "AUTH_ERROR")

    attributes.put(UserAttributeKey, user)
    Logger.debug("User authenticated", "userId: ${user._id}, companyId: ${user.companyId}")

    return user
}

package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.SessionRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.Session
import com.ilyasdemirkiran.types.response.ServerResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*

data class AuthContext(
  val session: Session,
  val user: FIUser
)

suspend inline fun <reified T> ApplicationCall.authenticate(
  requireCompany: Boolean = true,
  sessionRepository: SessionRepository = SessionRepository(),
  userRepository: UserRepository = UserRepository(),
  crossinline block: suspend (AuthContext) -> Unit
) {
  val authHeader = request.headers["Authorization"]
    ?: request.headers["authorization"]
    ?: request.headers["token"]

  val token = when {
    authHeader.isNullOrEmpty() -> null
    authHeader.startsWith("Bearer ", ignoreCase = true) -> authHeader.substring(7).trim()
    else -> authHeader.trim()
  }

  if (token.isNullOrEmpty()) {
    respond(
      HttpStatusCode.Unauthorized,
      ServerResponse<T>(
        success = false,
        message = "Unauthorized",
        error = "Authorization header with Bearer token is required"
      )
    )
    return
  }

  val session = sessionRepository.getValidSessionByToken(token)
  if (session == null) {
    respond(
      HttpStatusCode.Unauthorized,
      ServerResponse<T>(
        success = false,
        message = "Unauthorized",
        error = "Invalid or expired session token"
      )
    )
    return
  }

  val user = userRepository.getById(session.userId)
  if (user == null) {
    respond(
      HttpStatusCode.Unauthorized,
      ServerResponse<T>(
        success = false,
        message = "Unauthorized",
        error = "User not found"
      )
    )
    return
  }

  if (requireCompany && user.companyId == null) {
    respond(
      HttpStatusCode.Forbidden,
      ServerResponse<T>(
        success = false,
        message = "Company membership required",
        error = "You must belong to a company to perform this operation"
      )
    )
    return
  }

  block(AuthContext(session = session, user = user))
}

package com.ilyasdemirkiran.types.response

import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.Session
import kotlinx.serialization.Serializable

@Serializable
data class ServerResponse<T>(
  val success: Boolean,
  val message: String? = null,
  val data: T? = null,
  val error: String? = null
)

@Serializable
data class LoginResponseData(
  val token: String,
  val user: FIUser,
  val session: Session
)

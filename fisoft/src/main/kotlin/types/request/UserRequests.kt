package com.ilyasdemirkiran.types.request

import kotlinx.serialization.Serializable

@Serializable
data class CreateUserRequest(
  val phoneNumber: String,
  val password: String,
  val name: String,
  val surname: String
)

@Serializable
data class UpdateUserRequest(
  val phoneNumber: String? = null,
  val password: String? = null,
  val name: String? = null,
  val surname: String? = null
)

@Serializable
data class LoginRequest(
  val phoneNumber: String,
  val password: String
)

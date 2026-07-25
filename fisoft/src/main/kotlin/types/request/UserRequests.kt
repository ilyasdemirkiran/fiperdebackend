package com.ilyasdemirkiran.types.request

import kotlinx.serialization.Serializable

@Serializable
data class CreateUserRequest(
  val phoneNumber: String,
  val name: String,
  val surname: String
)

@Serializable
data class UpdateUserRequest(
  val phoneNumber: String? = null,
  val name: String? = null,
  val surname: String? = null
)

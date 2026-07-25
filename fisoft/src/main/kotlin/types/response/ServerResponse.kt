package com.ilyasdemirkiran.types.response

import kotlinx.serialization.Serializable

@Serializable
data class ServerResponse<T>(
  val success: Boolean,
  val message: String,
  val data: T? = null,
  val error: String? = null
)

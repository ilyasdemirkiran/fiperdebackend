package com.ilyasdemirkiran.types.request

import kotlinx.serialization.Serializable

@Serializable
data class CreateCompanyRequest(
  val name: String,
  val address: String = ""
)

@Serializable
data class UpdateCompanyRequest(
  val name: String? = null,
  val address: String? = null
)

@Serializable
data class InviteUserRequest(
  val phone: String
)

@Serializable
data class RespondInviteRequest(
  val accept: Boolean
)

@Serializable
data class UpdateCompanyNameRequest(
  val name: String
)

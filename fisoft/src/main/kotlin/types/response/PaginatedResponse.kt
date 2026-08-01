package com.ilyasdemirkiran.types.response

import kotlinx.serialization.Serializable

@Serializable
data class PaginatedResponseData<T>(
  val items: List<T>,
  val total: Long,
  val filteredTotal: Long = total,
  val page: Int,
  val size: Int,
  val totalPages: Int
)

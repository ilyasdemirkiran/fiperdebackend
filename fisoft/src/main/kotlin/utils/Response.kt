package com.ilyasdemirkiran.utils

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class ApiMeta(
    val page: Int? = null,
    val limit: Int? = null,
    val total: Long? = null
)

@Serializable
data class ApiError(
    val message: String,
    val code: String? = null,
    val details: JsonObject? = null
)

@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ApiError? = null,
    val meta: ApiMeta? = null
)

fun <T> successResponse(data: T, meta: ApiMeta? = null): ApiResponse<T> {
    return ApiResponse(
        success = true,
        data = data,
        meta = meta
    )
}

fun errorResponse(message: String, code: String? = null, details: JsonObject? = null): ApiResponse<Nothing> {
    return ApiResponse(
        success = false,
        error = ApiError(message = message, code = code, details = details)
    )
}

fun <T> paginatedResponse(data: List<T>, page: Int, limit: Int, total: Long): ApiResponse<List<T>> {
    return ApiResponse(
        success = true,
        data = data,
        meta = ApiMeta(page = page, limit = limit, total = total)
    )
}

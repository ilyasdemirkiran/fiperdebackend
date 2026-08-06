package com.ilyasdemirkiran.types

import kotlinx.serialization.Serializable
import org.bson.codecs.pojo.annotations.BsonId

@Serializable
enum class UserRole {
    sudo, admin, user
}

@Serializable
data class FIUser(
    @BsonId val _id: String,
    val phoneNumber: String = "",
    val name: String = "",
    val surname: String = "",
    val companyId: String? = null,
    val role: UserRole = UserRole.user,
    val createdAt: String = ""
) {
    fun isAdmin(): Boolean = role == UserRole.admin || role == UserRole.sudo
}
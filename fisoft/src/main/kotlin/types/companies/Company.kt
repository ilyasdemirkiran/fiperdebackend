package com.ilyasdemirkiran.types.companies

import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class Company(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    val name: String? = "",
    val registrationAgreement: Boolean? = true,
    val userIds: List<String> = emptyList(),              // Firebase UIDs
    val creatorUserId: String? = null,                     // Firebase UID
    val createdAt: String? = "",
    @BsonRepresentation(BsonType.OBJECT_ID) val logoOriginalFileId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val logoMiniFileId: String? = null
)

@Serializable
data class CompanyInvite(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    val inviterUserId: String? = null,                     // Firebase UID in MongoDB
    val creatorUserId: String? = null,                     // Firebase UID
    val invitedUserId: String? = null,                     // Firebase UID
    val invitedPhoneNumber: String? = null,
    val code: String? = null,
    val status: String? = "pending",
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class CompanyNote(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    val userId: String? = null,                            // Firebase UID
    val note: String? = "",
    val createdAt: String? = ""
)
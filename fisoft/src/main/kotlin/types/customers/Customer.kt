package com.ilyasdemirkiran.types.customers

import com.ilyasdemirkiran.types.Money
import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class CustomerDebt(
    val hasDebt: Boolean = false,
    val totalDebt: Money = Money.ZERO,
    val currency: String = "TRY"
)

@Serializable
data class Customer(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    val status: String = "active",
    val name: String = "",
    val surname: String = "",
    val phone: String? = null,
    val city: String? = null,
    val district: String? = null,
    val address: String? = null,
    val imageCount: Int = 0,
    val createdAt: String = "",
    val debt: List<CustomerDebt>? = null
)

@Serializable
data class CustomerImage(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val customerId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val originalFileId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val miniFileId: String? = null,
    val labels: List<String> = emptyList(),
    val uploadedAt: String = ""
)

@Serializable
data class CustomerImageLabel(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    val name: String = ""
)

@Serializable
data class CustomerNote(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val customerId: String? = null,
    val userId: String? = null,                            // Firebase UID — no ObjectId annotation
    val note: String = "",
    val createdAt: String = ""
)
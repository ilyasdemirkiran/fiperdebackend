package com.ilyasdemirkiran.types.quotes

import com.ilyasdemirkiran.types.Money
import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class QuoteItem(
    val id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val productId: String? = null,
    val name: String? = null,
    val publicName: String? = null,
    val quantity: Double? = 0.0,
    val unitPrice: Double? = 0.0,
    val originalCurrency: String? = "TRY",
    val convertedUnitPrice: Double? = 0.0,
    val totalPrice: Double? = 0.0
)

@Serializable
data class QuoteItemLabel(
    val id: String? = null,
    val name: String? = null
)

@Serializable
data class QuoteRoom(
    val id: String? = null,
    val name: String? = null,
    val items: List<QuoteItem> = emptyList(),
    val total: Double? = 0.0
)

@Serializable
data class QuoteConversions(
    val TRY: Double? = 1.0,
    val USD: Double? = 1.0,
    val EUR: Double? = 1.0
)

@Serializable
data class Quote(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    val quoteNumber: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val customerId: String? = null,
    val customerName: String? = null,
    val creatorId: String? = null,
    val creatorName: String? = null,
    val currency: String? = "TRY",
    val conversions: QuoteConversions? = QuoteConversions(),
    val rooms: List<QuoteRoom> = emptyList(),
    val status: String? = "draft",
    val total: Money = Money.ZERO,
    val discountPercent: Double? = 0.0,
    val totalAfterDiscount: Money = Money.ZERO,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

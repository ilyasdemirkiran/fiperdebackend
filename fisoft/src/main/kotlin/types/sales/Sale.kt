package com.ilyasdemirkiran.types.sales

import com.ilyasdemirkiran.types.Money
import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class PaymentLog(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val saleId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val customerId: String? = null,
    val createdByUserId: String? = null,
    val createdByUserName: String? = null,
    val amount: Money = Money.ZERO,
    val currency: String? = "TRY",
    val paymentType: String? = "cash",
    val description: String? = null,
    val paymentDate: String? = null,
    val createdAt: String? = null
)

@Serializable
data class Sale(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val customerId: String? = null,
    val createdByUserId: String? = null,
    val createdByUserName: String? = null,
    val totalAmount: Money = Money.ZERO,
    val totalPaidAmount: Money = Money.ZERO,
    val currency: String? = "TRY",
    val status: String? = "pending",
    val description: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val logs: List<PaymentLog> = emptyList()
)

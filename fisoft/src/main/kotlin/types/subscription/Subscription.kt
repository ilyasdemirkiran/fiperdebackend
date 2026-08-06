package com.ilyasdemirkiran.types.subscription

import com.ilyasdemirkiran.types.Money
import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class Subscription(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    val status: String = "active",
    val plan: String = "monthly",
    val paytrMerchantOid: String = "",
    val paytrPaymentAmount: Money = Money.ZERO,
    val subscriptionStartDate: String = "",
    val subscriptionEndDate: String = "",
    val createdAt: String = ""
)

@Serializable
data class SubscriptionInfo(
    val status: String = "",
    val plan: String = "",
    val expiresAt: String = ""
)

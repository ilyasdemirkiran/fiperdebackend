package com.ilyasdemirkiran.types.products

import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.vendors.Vendor
import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class Product(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    val name: String? = "",
    val code: String? = "",
    val price: Money = Money.ZERO,
    val currency: String? = "TRY",
    @BsonRepresentation(BsonType.OBJECT_ID) val vendorId: String? = "",
    val vendor: Vendor? = null,
    val vendorName: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
    val priceWithRate: Money? = null,
    val createdAt: String? = "",
    val updatedAt: String? = null
)

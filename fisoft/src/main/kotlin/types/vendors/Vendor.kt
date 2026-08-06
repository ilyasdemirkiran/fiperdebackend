package com.ilyasdemirkiran.types.vendors

import kotlinx.serialization.Serializable
import org.bson.BsonType
import org.bson.codecs.pojo.annotations.BsonId
import org.bson.codecs.pojo.annotations.BsonRepresentation

@Serializable
data class Vendor(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    val name: String = "",
    val phone: String? = null,
    val city: String? = null,
    val district: String? = null,
    val address: String? = null,
    val createdAt: String? = null
)

@Serializable
data class VendorDocument(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val vendorId: String? = null,
    val title: String = "",
    @BsonRepresentation(BsonType.OBJECT_ID) val fileId: String? = null,
    val fileName: String? = null,
    val fileType: String? = null,
    val uploadedAt: String? = null
)

@Serializable
data class VendorPermission(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val vendorId: String? = null,
    val grantedAt: String? = null
)

@Serializable
data class VendorPriceRate(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val vendorId: String? = null,
    val rate: Double? = 0.0,
    val updatedAt: String? = null
)

@Serializable
data class PriceListRequest(
    @BsonId @BsonRepresentation(BsonType.OBJECT_ID) val _id: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val companyId: String? = null,
    val companyName: String? = null,
    @BsonRepresentation(BsonType.OBJECT_ID) val vendorId: String? = null,
    val vendorName: String? = null,
    val status: String? = "pending",
    val message: String? = null,
    val createdAt: String? = null
)

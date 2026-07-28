package com.ilyasdemirkiran.types.request

import com.ilyasdemirkiran.types.customers.CustomerStatus
import com.ilyasdemirkiran.types.sales.PaymentType
import com.ilyasdemirkiran.types.sales.SaleStatus
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

// Customer DTOs
@Serializable
data class CreateCustomerRequest(
  val name: String,
  val surname: String,
  val phoneNumber: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null,
  val status: CustomerStatus = CustomerStatus.Active
)

@Serializable
data class UpdateCustomerRequest(
  val name: String? = null,
  val surname: String? = null,
  val phoneNumber: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null,
  val status: CustomerStatus? = null
)

// Vendor DTOs
@Serializable
data class CreateVendorRequest(
  val name: String,
  val phone: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null
)

@Serializable
data class UpdateVendorRequest(
  val name: String? = null,
  val phone: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null
)

// Product DTOs
@Serializable
data class CreateProductRequest(
  val name: String,
  val code: String,
  val price: Int, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val vendorId: String? = null,
  val description: String? = null
)

@Serializable
data class UpdateProductRequest(
  val name: String? = null,
  val code: String? = null,
  val price: Int? = null, // Kuruş cinsinden Int
  val currency: String? = null,
  val vendorId: String? = null,
  val description: String? = null
)

// Sale DTOs
@Serializable
data class CreateSaleRequest(
  val customerId: String,
  val totalAmount: Int, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val status: SaleStatus = SaleStatus.Pending,
  val description: String? = null
)

@Serializable
data class UpdateSaleRequest(
  val totalAmount: Int? = null, // Kuruş cinsinden Int
  val currency: String? = null,
  val status: SaleStatus? = null,
  val description: String? = null
)

// SaleLog DTOs
@Serializable
data class AddPaymentLogRequest(
  val amount: Int, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val paymentType: PaymentType = PaymentType.Cash,
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val paymentDate: Instant? = null
)

// Tag / Label DTOs
@Serializable
data class CreateTagRequest(
  val name: String
)

@Serializable
data class UpdateTagRequest(
  val name: String
)

// Photo DTOs
@Serializable
data class CreatePhotoRequest(
  val title: String,
  val url: String,
  val filename: String,
  val customerId: String? = null,
  val description: String = "",
  val mimeType: String = "image/jpeg",
  val size: Long = 0L,
  val tagIds: List<String> = emptyList()
)

@Serializable
data class UpdatePhotoRequest(
  val title: String? = null,
  val description: String? = null,
  val customerId: String? = null,
  val tagIds: List<String>? = null
)

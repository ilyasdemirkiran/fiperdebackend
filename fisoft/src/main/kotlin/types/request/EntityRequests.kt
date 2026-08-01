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

@Serializable
data class CreateCustomerNoteRequest(
  val note: String
)

@Serializable
data class UpdateCustomerNoteRequest(
  val note: String
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

// Account DTOs
@Serializable
data class CreateAccountRequest(
  val name: String,
  val accountType: com.ilyasdemirkiran.types.accounts.AccountType = com.ilyasdemirkiran.types.accounts.AccountType.Bank,
  val accountNumber: String? = null,
  val bankName: String? = null,
  val iban: String? = null,
  val currency: String = "TRY",
  val description: String? = null
)

@Serializable
data class UpdateAccountRequest(
  val name: String? = null,
  val accountType: com.ilyasdemirkiran.types.accounts.AccountType? = null,
  val accountNumber: String? = null,
  val bankName: String? = null,
  val iban: String? = null,
  val currency: String? = null,
  val description: String? = null
)

// SaleLog DTOs
@Serializable
data class AddPaymentLogRequest(
  val amount: Int, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val paymentType: PaymentType = PaymentType.Cash,
  val accountId: String? = null,
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val paymentDate: Instant? = null
)

@Serializable
data class UpdatePaymentLogRequest(
  val amount: Int? = null,
  val currency: String? = null,
  val paymentType: PaymentType? = null,
  val accountId: String? = null,
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

// Quote DTOs
@Serializable
data class CreateQuoteRequest(
  val title: String? = null,
  val customerId: String? = null,
  val currency: String = "TRY", // TRY, USD, EUR
  val notes: String? = null,
  @Serializable(with = InstantSerializer::class) val validUntil: Instant? = null
)

@Serializable
data class UpdateQuoteRequest(
  val title: String? = null,
  val customerId: String? = null,
  val currency: String? = null,
  val currencyRate: Double? = null,
  val status: com.ilyasdemirkiran.types.quotes.QuoteStatus? = null,
  val notes: String? = null,
  @Serializable(with = InstantSerializer::class) val validUntil: Instant? = null
)

@Serializable
data class ApplyQuoteDiscountRequest(
  val discountType: com.ilyasdemirkiran.types.quotes.DiscountType, // Percentage veya Amount
  val value: Double // Percentage ise örn: 10 (%10), Amount ise kuruş cinsinden tutar (örn: 5000 = 50.00 TL)
)

@Serializable
data class CreateQuoteListRequest(
  val title: String,
  val sortOrder: Int = 0
)

@Serializable
data class UpdateQuoteListRequest(
  val title: String? = null,
  val sortOrder: Int? = null
)

@Serializable
data class AddQuoteItemRequest(
  val productId: String? = null,
  val productName: String,
  val productCode: String? = null,
  val quantity: Int = 1,
  val unitPrice: Int? = null, // Opsiyonel. null ise productId verilmişse Product'tan çekilir
  val discountAmount: Int = 0 // Kuruş cinsinden kaleme özel indirim
)

@Serializable
data class UpdateQuoteItemRequest(
  val productName: String? = null,
  val productCode: String? = null,
  val quantity: Int? = null,
  val unitPrice: Int? = null,
  val discountAmount: Int? = null
)

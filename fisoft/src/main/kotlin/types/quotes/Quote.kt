package com.ilyasdemirkiran.types.quotes

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.types.products.ProductsTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class QuoteStatus {
  Draft, Sent, Accepted, Rejected, Expired
}

@Serializable
enum class DiscountType {
  Percentage, Amount
}

// 1. Quotes Table & Model
object QuotesTable : UuidTable("quotes") {
  val companyId = reference("company_id", CompaniesTable).index()
  val customerId = reference("customer_id", CustomersTable).nullable().index()
  val createdByUserId = reference("created_by_user_id", FIUsersTable).index()
  val title = varchar("title", 300).nullable()
  val currency = varchar("currency", 10).default("TRY")
  val currencyRate = double("currency_rate").default(1.0)
  val totalAmount = integer("total_amount").default(0) // Kuruş cinsinden (brüt)
  val discountAmount = integer("discount_amount").default(0) // Kuruş cinsinden indirim
  val finalAmount = integer("final_amount").default(0) // Kuruş cinsinden (net)
  val status = enumerationByName<QuoteStatus>("status", 20).default(QuoteStatus.Draft).index()
  val notes = varchar("notes", 2000).nullable()
  val validUntil = timestamp("valid_until").nullable()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val updatedAt = timestamp("updated_at").nullable()

  init {
    index(isUnique = false, companyId, customerId)
    index(isUnique = false, companyId, createdAt)
  }
}

// 2. Quote Lists Table (Örn: Salon Grubu, Yatak Odası Grubu)
object QuoteListsTable : UuidTable("quote_lists") {
  val quoteId = reference("quote_id", QuotesTable).index()
  val title = varchar("title", 200)
  val sortOrder = integer("sort_order").default(0)
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
}

// 3. Quote Items Table (Teklif Kalemi)
object QuoteItemsTable : UuidTable("quote_items") {
  val quoteListId = reference("quote_list_id", QuoteListsTable).index()
  val productId = reference("product_id", ProductsTable).nullable().index()
  val productName = varchar("product_name", 300)
  val productCode = varchar("product_code", 100).nullable()
  val quantity = integer("quantity").default(1)
  val unitPrice = integer("unit_price").default(0) // Kuruş cinsinden birim fiyat
  val discountAmount = integer("discount_amount").default(0) // Kuruş cinsinden kaleme özel indirim
  val totalPrice = integer("total_price").default(0) // Kuruş cinsinden (unitPrice * quantity - discountAmount)
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
}

@Serializable
data class QuoteItem(
  val id: Uuid,
  val quoteListId: Uuid,
  val productId: Uuid? = null,
  val productName: String,
  val productCode: String? = null,
  val quantity: Int = 1,
  val unitPrice: Int = 0,
  val discountAmount: Int = 0,
  val totalPrice: Int = 0,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

@Serializable
data class QuoteList(
  val id: Uuid,
  val quoteId: Uuid,
  val title: String,
  val sortOrder: Int = 0,
  val items: List<QuoteItem> = emptyList(),
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

@Serializable
data class Quote(
  val id: Uuid,
  val companyId: Uuid,
  val customerId: Uuid? = null,
  val createdByUserId: Uuid,
  val title: String? = null,
  val currency: String = "TRY",
  val currencyRate: Double = 1.0,
  val totalAmount: Int = 0,
  val discountAmount: Int = 0,
  val finalAmount: Int = 0,
  val status: QuoteStatus = QuoteStatus.Draft,
  val notes: String? = null,
  val lists: List<QuoteList> = emptyList(),
  @Serializable(with = InstantSerializer::class) val validUntil: Instant? = null,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val updatedAt: Instant? = null
)

fun ResultRow.toQuoteItem() = QuoteItem(
  id = this[QuoteItemsTable.id].value,
  quoteListId = this[QuoteItemsTable.quoteListId].value,
  productId = this[QuoteItemsTable.productId]?.value,
  productName = this[QuoteItemsTable.productName],
  productCode = this[QuoteItemsTable.productCode],
  quantity = this[QuoteItemsTable.quantity],
  unitPrice = this[QuoteItemsTable.unitPrice],
  discountAmount = this[QuoteItemsTable.discountAmount],
  totalPrice = this[QuoteItemsTable.totalPrice],
  createdAt = this[QuoteItemsTable.createdAt]
)

fun ResultRow.toQuoteList(items: List<QuoteItem> = emptyList()) = QuoteList(
  id = this[QuoteListsTable.id].value,
  quoteId = this[QuoteListsTable.quoteId].value,
  title = this[QuoteListsTable.title],
  sortOrder = this[QuoteListsTable.sortOrder],
  items = items,
  createdAt = this[QuoteListsTable.createdAt]
)

fun ResultRow.toQuote(lists: List<QuoteList> = emptyList()) = Quote(
  id = this[QuotesTable.id].value,
  companyId = this[QuotesTable.companyId].value,
  customerId = this[QuotesTable.customerId]?.value,
  createdByUserId = this[QuotesTable.createdByUserId].value,
  title = this[QuotesTable.title],
  currency = this[QuotesTable.currency],
  currencyRate = this[QuotesTable.currencyRate],
  totalAmount = this[QuotesTable.totalAmount],
  discountAmount = this[QuotesTable.discountAmount],
  finalAmount = this[QuotesTable.finalAmount],
  status = this[QuotesTable.status],
  notes = this[QuotesTable.notes],
  lists = lists,
  validUntil = this[QuotesTable.validUntil],
  createdAt = this[QuotesTable.createdAt],
  updatedAt = this[QuotesTable.updatedAt]
)

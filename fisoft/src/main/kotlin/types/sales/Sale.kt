package com.ilyasdemirkiran.types.sales

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class SaleStatus {
  Pending, Completed, Deleted
}

object SalesTable : UuidTable("sales") {
  val companyId = reference("company_id", CompaniesTable).index()
  val customerId = reference("customer_id", CustomersTable).index()
  val createdByUserId = reference("created_by_user_id", FIUsersTable).index()
  val createdByUserName = varchar("created_by_user_name", 200).nullable()
  val totalAmount = integer("total_amount") // Kuruş cinsinden (örn: 10000 = 100.00 TL)
  val totalPaidAmount = integer("total_paid_amount").default(0)
  val currency = varchar("currency", 10).default("TRY")
  val status = enumerationByName<SaleStatus>("status", 20).default(SaleStatus.Pending).index()
  val description = varchar("description", 1000).nullable()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val updatedAt = timestamp("updated_at").nullable()

  init {
    index(isUnique = false, companyId, customerId)
    index(isUnique = false, companyId, createdAt)
  }
}

@Serializable
data class Sale(
  val id: Uuid,
  val companyId: Uuid,
  val customerId: Uuid,
  val createdByUserId: Uuid,
  val createdByUserName: String? = null,
  val totalAmount: Int, // Kuruş cinsinden Int
  val totalPaidAmount: Int = 0, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val status: SaleStatus = SaleStatus.Pending,
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val updatedAt: Instant? = null
)

fun ResultRow.toSale() = Sale(
  id = this[SalesTable.id].value,
  companyId = this[SalesTable.companyId].value,
  customerId = this[SalesTable.customerId].value,
  createdByUserId = this[SalesTable.createdByUserId].value,
  createdByUserName = this[SalesTable.createdByUserName],
  totalAmount = this[SalesTable.totalAmount],
  totalPaidAmount = this[SalesTable.totalPaidAmount],
  currency = this[SalesTable.currency],
  status = this[SalesTable.status],
  description = this[SalesTable.description],
  createdAt = this[SalesTable.createdAt],
  updatedAt = this[SalesTable.updatedAt]
)

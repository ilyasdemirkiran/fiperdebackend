package com.ilyasdemirkiran.types.sales

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.accounts.AccountsTable
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
enum class PaymentType {
  Cash, BankTransfer, CreditCard, Check, Other
}

object SaleLogsTable : UuidTable("sale_logs") {
  val saleId = reference("sale_id", SalesTable).index()
  val companyId = reference("company_id", CompaniesTable).index()
  val customerId = reference("customer_id", CustomersTable).index()
  val createdByUserId = reference("created_by_user_id", FIUsersTable).index()
  val accountId = reference("account_id", AccountsTable).nullable().index()
  val createdByUserName = varchar("created_by_user_name", 200).nullable()
  val amount = integer("amount") // Kuruş cinsinden Int (örn: 5000 = 50.00 TL)
  val currency = varchar("currency", 10).default("TRY")
  val paymentType = enumerationByName<PaymentType>("payment_type", 20).default(PaymentType.Cash)
  val description = varchar("description", 1000).nullable()
  val paymentDate = timestamp("payment_date").index()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  init {
    index(isUnique = false, companyId, paymentDate)
    index(isUnique = false, companyId, customerId)
    index(isUnique = false, companyId, accountId)
  }
}

@Serializable
data class SaleLog(
  val id: Uuid,
  val saleId: Uuid,
  val companyId: Uuid,
  val customerId: Uuid,
  val createdByUserId: Uuid,
  val accountId: Uuid? = null,
  val createdByUserName: String? = null,
  val amount: Int, // Kuruş cinsinden Int
  val currency: String = "TRY",
  val paymentType: PaymentType = PaymentType.Cash,
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val paymentDate: Instant,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

fun ResultRow.toSaleLog() = SaleLog(
  id = this[SaleLogsTable.id].value,
  saleId = this[SaleLogsTable.saleId].value,
  companyId = this[SaleLogsTable.companyId].value,
  customerId = this[SaleLogsTable.customerId].value,
  createdByUserId = this[SaleLogsTable.createdByUserId].value,
  accountId = this[SaleLogsTable.accountId]?.value,
  createdByUserName = this[SaleLogsTable.createdByUserName],
  amount = this[SaleLogsTable.amount],
  currency = this[SaleLogsTable.currency],
  paymentType = this[SaleLogsTable.paymentType],
  description = this[SaleLogsTable.description],
  paymentDate = this[SaleLogsTable.paymentDate],
  createdAt = this[SaleLogsTable.createdAt]
)

package com.ilyasdemirkiran.types.accounts

import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class AccountType {
  Bank, Cash, Pos, Other
}

object AccountsTable : UuidTable("accounts") {
  val companyId = reference("company_id", CompaniesTable).index()
  val name = varchar("name", 200).index()
  val accountType = enumerationByName<AccountType>("account_type", 20).default(AccountType.Bank)
  val accountNumber = varchar("account_number", 100).nullable()
  val bankName = varchar("bank_name", 100).nullable()
  val iban = varchar("iban", 50).nullable()
  val currency = varchar("currency", 10).default("TRY")
  val description = varchar("description", 500).nullable()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val updatedAt = timestamp("updated_at").clientDefault { Instant.now() }

  init {
    index(isUnique = false, companyId, name)
  }
}

@Serializable
data class Account(
  val id: Uuid,
  val companyId: Uuid,
  val name: String,
  val accountType: AccountType = AccountType.Bank,
  val accountNumber: String? = null,
  val bankName: String? = null,
  val iban: String? = null,
  val currency: String = "TRY",
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val updatedAt: Instant
)

fun ResultRow.toAccount() = Account(
  id = this[AccountsTable.id].value,
  companyId = this[AccountsTable.companyId].value,
  name = this[AccountsTable.name],
  accountType = this[AccountsTable.accountType],
  accountNumber = this[AccountsTable.accountNumber],
  bankName = this[AccountsTable.bankName],
  iban = this[AccountsTable.iban],
  currency = this[AccountsTable.currency],
  description = this[AccountsTable.description],
  createdAt = this[AccountsTable.createdAt],
  updatedAt = this[AccountsTable.updatedAt]
)

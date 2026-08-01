package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.accounts.Account
import com.ilyasdemirkiran.types.accounts.AccountType
import com.ilyasdemirkiran.types.accounts.AccountsTable
import com.ilyasdemirkiran.types.accounts.toAccount
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class AccountRepository {

  fun createAccount(
    companyId: Uuid,
    name: String,
    accountType: AccountType = AccountType.Bank,
    accountNumber: String? = null,
    bankName: String? = null,
    iban: String? = null,
    currency: String = "TRY",
    description: String? = null
  ): Account = transaction {
    val id = Uuid.random()
    val now = Instant.now()

    AccountsTable.insert {
      it[AccountsTable.id] = id
      it[AccountsTable.companyId] = companyId
      it[AccountsTable.name] = name
      it[AccountsTable.accountType] = accountType
      it[AccountsTable.accountNumber] = accountNumber
      it[AccountsTable.bankName] = bankName
      it[AccountsTable.iban] = iban
      it[AccountsTable.currency] = currency
      it[AccountsTable.description] = description
      it[AccountsTable.createdAt] = now
      it[AccountsTable.updatedAt] = now
    }

    Account(
      id = id,
      companyId = companyId,
      name = name,
      accountType = accountType,
      accountNumber = accountNumber,
      bankName = bankName,
      iban = iban,
      currency = currency,
      description = description,
      createdAt = now,
      updatedAt = now
    )
  }

  fun getAccountsByCompanyId(companyId: Uuid): List<Account> = transaction {
    AccountsTable.selectAll()
      .where { AccountsTable.companyId eq companyId }
      .orderBy(AccountsTable.createdAt to SortOrder.DESC)
      .map { it.toAccount() }
  }

  fun getAccountById(id: Uuid, companyId: Uuid): Account? = transaction {
    AccountsTable.selectAll()
      .where { (AccountsTable.id eq id) and (AccountsTable.companyId eq companyId) }
      .map { it.toAccount() }
      .firstOrNull()
  }

  fun updateAccount(
    id: Uuid,
    companyId: Uuid,
    name: String? = null,
    accountType: AccountType? = null,
    accountNumber: String? = null,
    bankName: String? = null,
    iban: String? = null,
    currency: String? = null,
    description: String? = null
  ): Account? = transaction {
    val now = Instant.now()
    val updated = AccountsTable.update({ (AccountsTable.id eq id) and (AccountsTable.companyId eq companyId) }) { update ->
      name?.let { update[AccountsTable.name] = it }
      accountType?.let { update[AccountsTable.accountType] = it }
      accountNumber?.let { update[AccountsTable.accountNumber] = it }
      bankName?.let { update[AccountsTable.bankName] = it }
      iban?.let { update[AccountsTable.iban] = it }
      currency?.let { update[AccountsTable.currency] = it }
      description?.let { update[AccountsTable.description] = it }
      update[AccountsTable.updatedAt] = now
    }

    if (updated > 0) {
      getAccountById(id, companyId)
    } else {
      null
    }
  }

  fun deleteAccount(id: Uuid, companyId: Uuid): Boolean = transaction {
    AccountsTable.deleteWhere { (AccountsTable.id eq id) and (AccountsTable.companyId eq companyId) } > 0
  }
}

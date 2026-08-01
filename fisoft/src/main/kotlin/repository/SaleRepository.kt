package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.sales.*
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class SaleRepository {

  fun createSale(
    companyId: Uuid,
    customerId: Uuid,
    createdByUserId: Uuid,
    createdByUserName: String? = null,
    totalAmount: Int,
    currency: String = "TRY",
    status: SaleStatus = SaleStatus.Pending,
    description: String? = null
  ): Sale = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    SalesTable.insert {
      it[SalesTable.id] = id
      it[SalesTable.companyId] = companyId
      it[SalesTable.customerId] = customerId
      it[SalesTable.createdByUserId] = createdByUserId
      it[SalesTable.createdByUserName] = createdByUserName
      it[SalesTable.totalAmount] = totalAmount
      it[SalesTable.totalPaidAmount] = 0
      it[SalesTable.currency] = currency
      it[SalesTable.status] = status
      it[SalesTable.description] = description
      it[SalesTable.createdAt] = createdAt
    }

    Sale(
      id = id,
      companyId = companyId,
      customerId = customerId,
      createdByUserId = createdByUserId,
      createdByUserName = createdByUserName,
      totalAmount = totalAmount,
      totalPaidAmount = 0,
      currency = currency,
      status = status,
      description = description,
      createdAt = createdAt
    )
  }

  fun getSaleById(id: Uuid, companyId: Uuid): Sale? = transaction {
    SalesTable.selectAll()
      .where { (SalesTable.id eq id) and (SalesTable.companyId eq companyId) }
      .map { it.toSale() }
      .firstOrNull()
  }

  fun getSalesByCompanyId(companyId: Uuid): List<Sale> = transaction {
    SalesTable.selectAll()
      .where { SalesTable.companyId eq companyId }
      .map { it.toSale() }
  }

  fun getSalesByCustomerId(customerId: Uuid, companyId: Uuid): List<Sale> = transaction {
    SalesTable.selectAll()
      .where { (SalesTable.customerId eq customerId) and (SalesTable.companyId eq companyId) }
      .map { it.toSale() }
  }

  fun updateSale(
    id: Uuid,
    companyId: Uuid,
    totalAmount: Int? = null,
    currency: String? = null,
    status: SaleStatus? = null,
    description: String? = null
  ): Sale? = transaction {
    val updatedAt = Instant.now()
    SalesTable.update({ (SalesTable.id eq id) and (SalesTable.companyId eq companyId) }) { update ->
      totalAmount?.let { update[SalesTable.totalAmount] = it }
      currency?.let { update[SalesTable.currency] = it }
      status?.let { update[SalesTable.status] = it }
      description?.let { update[SalesTable.description] = it }
      update[SalesTable.updatedAt] = updatedAt
    }

    getSaleById(id, companyId)
  }

  fun addPaymentLog(
    saleId: Uuid,
    companyId: Uuid,
    customerId: Uuid,
    createdByUserId: Uuid,
    createdByUserName: String?,
    amount: Int,
    currency: String = "TRY",
    paymentType: PaymentType = PaymentType.Cash,
    accountId: Uuid? = null,
    description: String? = null,
    paymentDate: Instant = Instant.now()
  ): SaleLog = transaction {
    val logId = Uuid.random()
    val createdAt = Instant.now()

    SaleLogsTable.insert {
      it[SaleLogsTable.id] = logId
      it[SaleLogsTable.saleId] = saleId
      it[SaleLogsTable.companyId] = companyId
      it[SaleLogsTable.customerId] = customerId
      it[SaleLogsTable.createdByUserId] = createdByUserId
      it[SaleLogsTable.createdByUserName] = createdByUserName
      it[SaleLogsTable.amount] = amount
      it[SaleLogsTable.currency] = currency
      it[SaleLogsTable.paymentType] = paymentType
      it[SaleLogsTable.accountId] = accountId
      it[SaleLogsTable.description] = description
      it[SaleLogsTable.paymentDate] = paymentDate
      it[SaleLogsTable.createdAt] = createdAt
    }

    val currentSale = SalesTable.selectAll()
      .where { (SalesTable.id eq saleId) and (SalesTable.companyId eq companyId) }
      .map { it.toSale() }
      .firstOrNull()

    if (currentSale != null) {
      val newPaidAmount = currentSale.totalPaidAmount + amount
      val newStatus = if (newPaidAmount >= currentSale.totalAmount) SaleStatus.Completed else currentSale.status

      SalesTable.update({ SalesTable.id eq saleId }) { update ->
        update[SalesTable.totalPaidAmount] = newPaidAmount
        update[SalesTable.status] = newStatus
        update[SalesTable.updatedAt] = createdAt
      }
    }

    SaleLog(
      id = logId,
      saleId = saleId,
      companyId = companyId,
      customerId = customerId,
      createdByUserId = createdByUserId,
      accountId = accountId,
      createdByUserName = createdByUserName,
      amount = amount,
      currency = currency,
      paymentType = paymentType,
      description = description,
      paymentDate = paymentDate,
      createdAt = createdAt
    )
  }

  fun getLogsBySaleId(saleId: Uuid, companyId: Uuid): List<SaleLog> = transaction {
    SaleLogsTable.selectAll()
      .where { (SaleLogsTable.saleId eq saleId) and (SaleLogsTable.companyId eq companyId) }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }
  }

  fun getLogsByDateRange(companyId: Uuid, startDate: Instant, endDate: Instant): List<SaleLog> = transaction {
    SaleLogsTable.selectAll()
      .where {
        (SaleLogsTable.companyId eq companyId) and
          (SaleLogsTable.paymentDate greaterEq startDate) and
          (SaleLogsTable.paymentDate lessEq endDate)
      }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }
  }

  fun getLogsByAccountId(accountId: Uuid, companyId: Uuid): List<SaleLog> = transaction {
    SaleLogsTable.selectAll()
      .where { (SaleLogsTable.accountId eq accountId) and (SaleLogsTable.companyId eq companyId) }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }
  }

  fun getLogsByAccountIdAndYear(accountId: Uuid, companyId: Uuid, year: Int): List<SaleLog> = transaction {
    val startOfYear = java.time.Year.of(year).atDay(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant()
    val endOfYear = java.time.Year.of(year).atMonth(12).atEndOfMonth().atTime(23, 59, 59, 999_999_999).atZone(java.time.ZoneOffset.UTC).toInstant()

    SaleLogsTable.selectAll()
      .where {
        (SaleLogsTable.accountId eq accountId) and
          (SaleLogsTable.companyId eq companyId) and
          (SaleLogsTable.paymentDate greaterEq startOfYear) and
          (SaleLogsTable.paymentDate lessEq endOfYear)
      }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }
  }

  fun getLogsByAccountIdAndMonth(accountId: Uuid, companyId: Uuid, year: Int, month: Int): List<SaleLog> = transaction {
    val yearMonth = java.time.YearMonth.of(year, month)
    val startOfMonth = yearMonth.atDay(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant()
    val endOfMonth = yearMonth.atEndOfMonth().atTime(23, 59, 59, 999_999_999).atZone(java.time.ZoneOffset.UTC).toInstant()

    SaleLogsTable.selectAll()
      .where {
        (SaleLogsTable.accountId eq accountId) and
          (SaleLogsTable.companyId eq companyId) and
          (SaleLogsTable.paymentDate greaterEq startOfMonth) and
          (SaleLogsTable.paymentDate lessEq endOfMonth)
      }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }
  }

  fun updatePaymentLog(
    logId: Uuid,
    companyId: Uuid,
    amount: Int? = null,
    currency: String? = null,
    paymentType: PaymentType? = null,
    accountId: Uuid? = null,
    description: String? = null,
    paymentDate: Instant? = null
  ): SaleLog? = transaction {
    val existingLog = SaleLogsTable.selectAll()
      .where { (SaleLogsTable.id eq logId) and (SaleLogsTable.companyId eq companyId) }
      .map { it.toSaleLog() }
      .firstOrNull() ?: return@transaction null

    SaleLogsTable.update({ (SaleLogsTable.id eq logId) and (SaleLogsTable.companyId eq companyId) }) { update ->
      amount?.let { update[SaleLogsTable.amount] = it }
      currency?.let { update[SaleLogsTable.currency] = it }
      paymentType?.let { update[SaleLogsTable.paymentType] = it }
      accountId?.let { update[SaleLogsTable.accountId] = it }
      description?.let { update[SaleLogsTable.description] = it }
      paymentDate?.let { update[SaleLogsTable.paymentDate] = it }
    }

    recalculateSalePaidAmount(existingLog.saleId, companyId)

    SaleLogsTable.selectAll()
      .where { (SaleLogsTable.id eq logId) and (SaleLogsTable.companyId eq companyId) }
      .map { it.toSaleLog() }
      .firstOrNull()
  }

  fun deletePaymentLog(logId: Uuid, companyId: Uuid): Boolean = transaction {
    val existingLog = SaleLogsTable.selectAll()
      .where { (SaleLogsTable.id eq logId) and (SaleLogsTable.companyId eq companyId) }
      .map { it.toSaleLog() }
      .firstOrNull() ?: return@transaction false

    val deletedCount = SaleLogsTable.deleteWhere {
      (SaleLogsTable.id eq logId) and (SaleLogsTable.companyId eq companyId)
    }

    if (deletedCount > 0) {
      recalculateSalePaidAmount(existingLog.saleId, companyId)
      true
    } else {
      false
    }
  }

  private fun recalculateSalePaidAmount(saleId: Uuid, companyId: Uuid) {
    val currentSale = SalesTable.selectAll()
      .where { (SalesTable.id eq saleId) and (SalesTable.companyId eq companyId) }
      .map { it.toSale() }
      .firstOrNull() ?: return

    val totalPaid = SaleLogsTable.selectAll()
      .where { (SaleLogsTable.saleId eq saleId) and (SaleLogsTable.companyId eq companyId) }
      .sumOf { it[SaleLogsTable.amount] }

    val newStatus = if (totalPaid >= currentSale.totalAmount && currentSale.totalAmount > 0) {
      SaleStatus.Completed
    } else if (currentSale.status == SaleStatus.Completed && totalPaid < currentSale.totalAmount) {
      SaleStatus.Pending
    } else {
      currentSale.status
    }

    SalesTable.update({ (SalesTable.id eq saleId) and (SalesTable.companyId eq companyId) }) { update ->
      update[SalesTable.totalPaidAmount] = totalPaid
      update[SalesTable.status] = newStatus
      update[SalesTable.updatedAt] = Instant.now()
    }
  }
}

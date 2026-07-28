package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.sales.*
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.lessEq
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
    createdByUserName: String? = null,
    amount: Int,
    currency: String = "TRY",
    paymentType: PaymentType = PaymentType.Cash,
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
      it[SaleLogsTable.description] = description
      it[SaleLogsTable.paymentDate] = paymentDate
      it[SaleLogsTable.createdAt] = createdAt
    }

    // Toplam ödenen tutarı güncelle
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
      .map { it.toSaleLog() }
  }

  fun getLogsByDateRange(companyId: Uuid, startDate: Instant, endDate: Instant): List<SaleLog> = transaction {
    SaleLogsTable.selectAll()
      .where {
        (SaleLogsTable.companyId eq companyId) and
          (SaleLogsTable.paymentDate greaterEq startDate) and
          (SaleLogsTable.paymentDate lessEq endDate)
      }
      .map { it.toSaleLog() }
  }
}

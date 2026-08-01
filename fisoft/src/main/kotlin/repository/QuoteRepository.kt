package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.services.ExchangeRateService
import com.ilyasdemirkiran.types.products.ProductsTable
import com.ilyasdemirkiran.types.products.toProduct
import com.ilyasdemirkiran.types.quotes.*
import com.ilyasdemirkiran.types.response.PaginatedResponseData
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class QuoteRepository {

  suspend fun createQuote(
    companyId: Uuid,
    createdByUserId: Uuid,
    title: String? = null,
    customerId: Uuid? = null,
    currency: String = "TRY",
    notes: String? = null,
    validUntil: Instant? = null
  ): Quote {
    val quoteId = Uuid.random()
    val now = Instant.now()

    // Fetch TCMB rate for given currency
    val rates = ExchangeRateService.getRates()
    val rate = rates.firstOrNull { it.currency.equals(currency, ignoreCase = true) }?.rateInTRY ?: 1.0

    transaction {
      QuotesTable.insert {
        it[QuotesTable.id] = quoteId
        it[QuotesTable.companyId] = companyId
        it[QuotesTable.customerId] = customerId
        it[QuotesTable.createdByUserId] = createdByUserId
        it[QuotesTable.title] = title
        it[QuotesTable.currency] = currency.uppercase()
        it[QuotesTable.currencyRate] = rate
        it[QuotesTable.totalAmount] = 0
        it[QuotesTable.discountAmount] = 0
        it[QuotesTable.finalAmount] = 0
        it[QuotesTable.status] = QuoteStatus.Draft
        it[QuotesTable.notes] = notes
        it[QuotesTable.validUntil] = validUntil
        it[QuotesTable.createdAt] = now
        it[QuotesTable.updatedAt] = now
      }
    }

    return getQuoteById(quoteId, companyId)!!
  }

  fun getQuoteById(quoteId: Uuid, companyId: Uuid): Quote? = transaction {
    val quoteRow = QuotesTable.selectAll()
      .where { (QuotesTable.id eq quoteId) and (QuotesTable.companyId eq companyId) }
      .firstOrNull() ?: return@transaction null

    val lists = QuoteListsTable.selectAll()
      .where { QuoteListsTable.quoteId eq quoteId }
      .orderBy(QuoteListsTable.sortOrder to SortOrder.ASC)
      .map { listRow ->
        val listId = listRow[QuoteListsTable.id].value
        val items = QuoteItemsTable.selectAll()
          .where { QuoteItemsTable.quoteListId eq listId }
          .orderBy(QuoteItemsTable.createdAt to SortOrder.ASC)
          .map { it.toQuoteItem() }

        listRow.toQuoteList(items)
      }

    quoteRow.toQuote(lists)
  }

  fun getQuotesByCompanyId(
    companyId: Uuid,
    search: String? = null,
    customerId: Uuid? = null,
    status: QuoteStatus? = null,
    page: Int = 1,
    size: Int = 30
  ): PaginatedResponseData<Quote> = transaction {
    val queryTrimmed = search?.trim()

    val baseQuery = CustomersTableJoinQuery(companyId, queryTrimmed, customerId, status)

    val totalAll = QuotesTable.selectAll()
      .where { QuotesTable.companyId eq companyId }
      .count()

    val filteredTotal = baseQuery.count()
    val totalPages = if (filteredTotal == 0L) 1 else kotlin.math.ceil(filteredTotal.toDouble() / size).toInt()
    val currentPage = page.coerceAtLeast(1)
    val offset = ((currentPage - 1) * size).toLong()

    val quotes = baseQuery
      .orderBy(QuotesTable.createdAt to SortOrder.DESC)
      .limit(size)
      .offset(offset)
      .map { row ->
        val qId = row[QuotesTable.id].value
        val lists = QuoteListsTable.selectAll()
          .where { QuoteListsTable.quoteId eq qId }
          .orderBy(QuoteListsTable.sortOrder to SortOrder.ASC)
          .map { listRow ->
            val listId = listRow[QuoteListsTable.id].value
            val items = QuoteItemsTable.selectAll()
              .where { QuoteItemsTable.quoteListId eq listId }
              .map { it.toQuoteItem() }
            listRow.toQuoteList(items)
          }
        row.toQuote(lists)
      }

    PaginatedResponseData(
      items = quotes,
      total = totalAll,
      filteredTotal = filteredTotal,
      page = currentPage,
      size = size,
      totalPages = totalPages
    )
  }

  private fun CustomersTableJoinQuery(
    companyId: Uuid,
    search: String?,
    customerId: Uuid?,
    status: QuoteStatus?
  ) = QuotesTable.selectAll().where {
    var condition = QuotesTable.companyId eq companyId
    if (customerId != null) {
      condition = condition and (QuotesTable.customerId eq customerId)
    }
    if (status != null) {
      condition = condition and (QuotesTable.status eq status)
    }
    if (!search.isNullOrEmpty()) {
      val pattern = "%${search.lowercase()}%"
      condition = condition and (QuotesTable.title.lowerCase() like pattern)
    }
    condition
  }

  suspend fun updateQuote(
    quoteId: Uuid,
    companyId: Uuid,
    title: String? = null,
    customerId: Uuid? = null,
    currency: String? = null,
    currencyRate: Double? = null,
    status: QuoteStatus? = null,
    notes: String? = null,
    validUntil: Instant? = null
  ): Quote? {
    var finalRate: Double? = currencyRate
    if (currency != null && currencyRate == null) {
      val rates = ExchangeRateService.getRates()
      finalRate = rates.firstOrNull { it.currency.equals(currency, ignoreCase = true) }?.rateInTRY ?: 1.0
    }

    transaction {
      val now = Instant.now()
      QuotesTable.update({ (QuotesTable.id eq quoteId) and (QuotesTable.companyId eq companyId) }) { update ->
        title?.let { update[QuotesTable.title] = it }
        customerId?.let { update[QuotesTable.customerId] = it }
        currency?.let { update[QuotesTable.currency] = it.uppercase() }
        finalRate?.let { update[QuotesTable.currencyRate] = it }
        status?.let { update[QuotesTable.status] = it }
        notes?.let { update[QuotesTable.notes] = it }
        validUntil?.let { update[QuotesTable.validUntil] = it }
        update[QuotesTable.updatedAt] = now
      }
    }

    return getQuoteById(quoteId, companyId)
  }

  fun applyDiscount(
    quoteId: Uuid,
    companyId: Uuid,
    discountType: DiscountType,
    value: Double
  ): Quote? = transaction {
    val quote = getQuoteById(quoteId, companyId) ?: return@transaction null

    val calculatedDiscount = if (discountType == DiscountType.Percentage) {
      kotlin.math.round((quote.totalAmount * (value / 100.0))).toInt()
    } else {
      value.toInt()
    }

    val finalAmount = (quote.totalAmount - calculatedDiscount).coerceAtLeast(0)

    QuotesTable.update({ (QuotesTable.id eq quoteId) and (QuotesTable.companyId eq companyId) }) { update ->
      update[QuotesTable.discountAmount] = calculatedDiscount
      update[QuotesTable.finalAmount] = finalAmount
      update[QuotesTable.updatedAt] = Instant.now()
    }

    getQuoteById(quoteId, companyId)
  }

  fun deleteQuote(quoteId: Uuid, companyId: Uuid): Boolean = transaction {
    val lists = QuoteListsTable.selectAll().where { QuoteListsTable.quoteId eq quoteId }.map { it[QuoteListsTable.id].value }
    for (listId in lists) {
      QuoteItemsTable.deleteWhere { QuoteItemsTable.quoteListId eq listId }
    }
    QuoteListsTable.deleteWhere { QuoteListsTable.quoteId eq quoteId }
    QuotesTable.deleteWhere { (QuotesTable.id eq quoteId) and (QuotesTable.companyId eq companyId) } > 0
  }

  // Quote List CRUD
  fun createQuoteList(quoteId: Uuid, companyId: Uuid, title: String, sortOrder: Int = 0): QuoteList? = transaction {
    val quote = getQuoteById(quoteId, companyId) ?: return@transaction null
    val listId = Uuid.random()
    val now = Instant.now()

    QuoteListsTable.insert {
      it[QuoteListsTable.id] = listId
      it[QuoteListsTable.quoteId] = quote.id
      it[QuoteListsTable.title] = title
      it[QuoteListsTable.sortOrder] = sortOrder
      it[QuoteListsTable.createdAt] = now
    }

    QuoteList(id = listId, quoteId = quote.id, title = title, sortOrder = sortOrder, createdAt = now)
  }

  fun updateQuoteList(listId: Uuid, companyId: Uuid, title: String? = null, sortOrder: Int? = null): QuoteList? = transaction {
    val listRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull() ?: return@transaction null
    val quoteId = listRow[QuoteListsTable.quoteId].value
    getQuoteById(quoteId, companyId) ?: return@transaction null

    QuoteListsTable.update({ QuoteListsTable.id eq listId }) { update ->
      title?.let { update[QuoteListsTable.title] = it }
      sortOrder?.let { update[QuoteListsTable.sortOrder] = it }
    }

    val updatedRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull()!!
    val items = QuoteItemsTable.selectAll().where { QuoteItemsTable.quoteListId eq listId }.map { it.toQuoteItem() }
    updatedRow.toQuoteList(items)
  }

  fun deleteQuoteList(listId: Uuid, companyId: Uuid): Boolean = transaction {
    val listRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull() ?: return@transaction false
    val quoteId = listRow[QuoteListsTable.quoteId].value
    getQuoteById(quoteId, companyId) ?: return@transaction false

    QuoteItemsTable.deleteWhere { QuoteItemsTable.quoteListId eq listId }
    val deleted = QuoteListsTable.deleteWhere { QuoteListsTable.id eq listId } > 0
    if (deleted) {
      recalculateQuoteTotals(quoteId, companyId)
    }
    deleted
  }

  // Quote Item CRUD
  fun addQuoteItem(
    listId: Uuid,
    companyId: Uuid,
    productId: Uuid? = null,
    productName: String,
    productCode: String? = null,
    quantity: Int = 1,
    unitPrice: Int? = null,
    discountAmount: Int = 0
  ): QuoteItem? = transaction {
    val listRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull() ?: return@transaction null
    val quoteId = listRow[QuoteListsTable.quoteId].value
    val quote = getQuoteById(quoteId, companyId) ?: return@transaction null

    var priceToUse = unitPrice
    var codeToUse = productCode

    if (productId != null && priceToUse == null) {
      val product = ProductsTable.selectAll().where { ProductsTable.id eq productId }.map { it.toProduct() }.firstOrNull()
      if (product != null) {
        priceToUse = product.price
        if (codeToUse == null) codeToUse = product.code
      }
    }

    val actualUnitPrice = priceToUse ?: 0
    val actualQuantity = quantity.coerceAtLeast(1)
    val itemTotalPrice = (actualUnitPrice * actualQuantity - discountAmount).coerceAtLeast(0)

    val itemId = Uuid.random()
    val now = Instant.now()

    QuoteItemsTable.insert {
      it[QuoteItemsTable.id] = itemId
      it[QuoteItemsTable.quoteListId] = listId
      it[QuoteItemsTable.productId] = productId
      it[QuoteItemsTable.productName] = productName
      it[QuoteItemsTable.productCode] = codeToUse
      it[QuoteItemsTable.quantity] = actualQuantity
      it[QuoteItemsTable.unitPrice] = actualUnitPrice
      it[QuoteItemsTable.discountAmount] = discountAmount
      it[QuoteItemsTable.totalPrice] = itemTotalPrice
      it[QuoteItemsTable.createdAt] = now
    }

    recalculateQuoteTotals(quote.id, companyId)

    QuoteItem(
      id = itemId,
      quoteListId = listId,
      productId = productId,
      productName = productName,
      productCode = codeToUse,
      quantity = actualQuantity,
      unitPrice = actualUnitPrice,
      discountAmount = discountAmount,
      totalPrice = itemTotalPrice,
      createdAt = now
    )
  }

  fun updateQuoteItem(
    itemId: Uuid,
    companyId: Uuid,
    productName: String? = null,
    productCode: String? = null,
    quantity: Int? = null,
    unitPrice: Int? = null,
    discountAmount: Int? = null
  ): QuoteItem? = transaction {
    val itemRow = QuoteItemsTable.selectAll().where { QuoteItemsTable.id eq itemId }.firstOrNull() ?: return@transaction null
    val listId = itemRow[QuoteItemsTable.quoteListId].value
    val listRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull() ?: return@transaction null
    val quoteId = listRow[QuoteListsTable.quoteId].value
    getQuoteById(quoteId, companyId) ?: return@transaction null

    val currentQty = quantity ?: itemRow[QuoteItemsTable.quantity]
    val currentUnitPrice = unitPrice ?: itemRow[QuoteItemsTable.unitPrice]
    val currentDiscount = discountAmount ?: itemRow[QuoteItemsTable.discountAmount]
    val newTotalPrice = (currentUnitPrice * currentQty - currentDiscount).coerceAtLeast(0)

    QuoteItemsTable.update({ QuoteItemsTable.id eq itemId }) { update ->
      productName?.let { update[QuoteItemsTable.productName] = it }
      productCode?.let { update[QuoteItemsTable.productCode] = it }
      quantity?.let { update[QuoteItemsTable.quantity] = it }
      unitPrice?.let { update[QuoteItemsTable.unitPrice] = it }
      discountAmount?.let { update[QuoteItemsTable.discountAmount] = it }
      update[QuoteItemsTable.totalPrice] = newTotalPrice
    }

    recalculateQuoteTotals(quoteId, companyId)

    QuoteItemsTable.selectAll().where { QuoteItemsTable.id eq itemId }.map { it.toQuoteItem() }.firstOrNull()
  }

  fun deleteQuoteItem(itemId: Uuid, companyId: Uuid): Boolean = transaction {
    val itemRow = QuoteItemsTable.selectAll().where { QuoteItemsTable.id eq itemId }.firstOrNull() ?: return@transaction false
    val listId = itemRow[QuoteItemsTable.quoteListId].value
    val listRow = QuoteListsTable.selectAll().where { QuoteListsTable.id eq listId }.firstOrNull() ?: return@transaction false
    val quoteId = listRow[QuoteListsTable.quoteId].value
    getQuoteById(quoteId, companyId) ?: return@transaction false

    val deleted = QuoteItemsTable.deleteWhere { QuoteItemsTable.id eq itemId } > 0
    if (deleted) {
      recalculateQuoteTotals(quoteId, companyId)
    }
    deleted
  }

  private fun recalculateQuoteTotals(quoteId: Uuid, companyId: Uuid) {
    val lists = QuoteListsTable.selectAll().where { QuoteListsTable.quoteId eq quoteId }.map { it[QuoteListsTable.id].value }
    var sumTotalAmount = 0
    if (lists.isNotEmpty()) {
      val items = QuoteItemsTable.selectAll().where { QuoteItemsTable.quoteListId inList lists }.map { it.toQuoteItem() }
      sumTotalAmount = items.sumOf { it.totalPrice }
    }

    val currentQuote = QuotesTable.selectAll().where { QuotesTable.id eq quoteId }.map { it.toQuote() }.firstOrNull()
    val discount = currentQuote?.discountAmount ?: 0
    val finalAmt = (sumTotalAmount - discount).coerceAtLeast(0)

    QuotesTable.update({ QuotesTable.id eq quoteId }) { update ->
      update[QuotesTable.totalAmount] = sumTotalAmount
      update[QuotesTable.finalAmount] = finalAmt
      update[QuotesTable.updatedAt] = Instant.now()
    }
  }
}

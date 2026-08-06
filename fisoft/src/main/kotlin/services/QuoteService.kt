package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.ProductRepository
import com.ilyasdemirkiran.repository.QuoteRepository
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.quotes.*
import io.ktor.http.*
import java.time.Instant
import java.util.UUID

class QuoteService(
    private val repo: QuoteRepository = QuoteRepository(),
    private val productRepo: ProductRepository = ProductRepository(),
    private val customerService: CustomerService = CustomerService()
) {
    private fun ensureEditable(quote: Quote) {
        if (quote.status == "approved" || quote.status == "denied") {
            throw AppError(HttpStatusCode.BadRequest, "Approved or Denied quotes cannot be edited.", "READ_ONLY_ERROR")
        }
    }

    private suspend fun recalculateAndSave(companyId: String, quote: Quote): Quote {
        val updatedRooms = quote.rooms.map { room ->
            val roomTotal = room.items.fold(0.0) { acc, item -> acc + (item.totalPrice ?: 0.0) }
            room.copy(total = roomTotal)
        }

        val grandTotalDouble = updatedRooms.fold(0.0) { acc, r -> acc + (r.total ?: 0.0) }
        val grandTotal = Money.fromDouble(grandTotalDouble)
        val totalAfterDiscount = grandTotal.applyDiscountPercent(quote.discountPercent ?: 0.0)

        val updated = quote.copy(
            rooms = updatedRooms,
            total = grandTotal,
            totalAfterDiscount = totalAfterDiscount
        )

        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun createQuote(companyId: String, creatorId: String, creatorName: String, currency: String = "TRY", conversions: QuoteConversions = QuoteConversions()): Quote {
        val quoteNumber = repo.getNextQuoteNumber(companyId)
        val quote = Quote(
            companyId = companyId,
            quoteNumber = quoteNumber,
            creatorId = creatorId,
            creatorName = creatorName,
            currency = currency,
            conversions = conversions,
            rooms = emptyList(),
            status = "draft",
            createdAt = Instant.now().toString()
        )
        return repo.create(companyId, quote)
    }

    suspend fun getQuote(companyId: String, id: String): Quote {
        return repo.findById(companyId, id)
            ?: throw AppError(HttpStatusCode.NotFound, "Quote not found", "QUOTE_NOT_FOUND")
    }

    suspend fun updateQuoteCustomer(companyId: String, id: String, customerId: String?, customerName: String?): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)
        val updated = quote.copy(customerId = customerId, customerName = customerName)
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun updateQuoteCurrency(companyId: String, id: String, currency: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)
        val updated = quote.copy(currency = currency)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun updateQuoteConversions(companyId: String, id: String, conversions: QuoteConversions): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)
        val updated = quote.copy(conversions = conversions)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun updateDiscountPercent(companyId: String, id: String, discountPercent: Double): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)
        val updated = quote.copy(discountPercent = discountPercent)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun addRoom(companyId: String, id: String, name: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val room = QuoteRoom(
            id = UUID.randomUUID().toString(),
            name = name,
            items = emptyList(),
            total = 0.0
        )

        val updated = quote.copy(rooms = quote.rooms + room)
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun updateRoomName(companyId: String, id: String, roomId: String, name: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) r.copy(name = name) else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun deleteRoom(companyId: String, id: String, roomId: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val updatedRooms = quote.rooms.filter { it.id != roomId }
        val updated = quote.copy(rooms = updatedRooms)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun addItemsToRoom(companyId: String, id: String, roomId: String, itemsInput: List<Pair<String, Double>>): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val room = quote.rooms.find { it.id == roomId }
            ?: throw AppError(HttpStatusCode.NotFound, "Room not found", "ROOM_NOT_FOUND")

        val newItems = mutableListOf<QuoteItem>()
        for ((productId, quantity) in itemsInput) {
            val product = productRepo.findById(productId)
                ?: throw AppError(HttpStatusCode.BadRequest, "Product not found: $productId", "PRODUCT_NOT_FOUND")

            val conversionRate = when (product.currency) {
                "USD" -> quote.conversions?.USD ?: 1.0
                "EUR" -> quote.conversions?.EUR ?: 1.0
                else -> quote.conversions?.TRY ?: 1.0
            }

            val unitPrice = product.price.toDouble
            val convertedUnitPrice = unitPrice * conversionRate
            val totalPrice = convertedUnitPrice * quantity

            newItems.add(
                QuoteItem(
                    id = UUID.randomUUID().toString(),
                    productId = product._id,
                    name = product.name,
                    publicName = "",
                    quantity = quantity,
                    unitPrice = unitPrice,
                    originalCurrency = product.currency,
                    convertedUnitPrice = convertedUnitPrice,
                    totalPrice = totalPrice
                )
            )
        }

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) r.copy(items = r.items + newItems) else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun addCustomItemToRoom(
        companyId: String,
        id: String,
        roomId: String,
        name: String,
        quantity: Double,
        unitPrice: Double,
        currency: String
    ): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val conversionRate = when (currency) {
            "USD" -> quote.conversions?.USD ?: 1.0
            "EUR" -> quote.conversions?.EUR ?: 1.0
            else -> quote.conversions?.TRY ?: 1.0
        }

        val convertedUnitPrice = unitPrice * conversionRate
        val totalPrice = convertedUnitPrice * quantity

        val newItem = QuoteItem(
            id = UUID.randomUUID().toString(),
            name = name,
            publicName = "",
            quantity = quantity,
            unitPrice = unitPrice,
            originalCurrency = currency,
            convertedUnitPrice = convertedUnitPrice,
            totalPrice = totalPrice
        )

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) r.copy(items = r.items + newItem) else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun updateItem(
        companyId: String,
        id: String,
        roomId: String,
        itemId: String,
        quantity: Double?,
        customPrice: Double?
    ): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) {
                val updatedItems = r.items.map { item ->
                    if (item.id == itemId) {
                        val newQty = quantity ?: (item.quantity ?: 0.0)
                        val newPrice = customPrice ?: (item.unitPrice ?: 0.0)

                        val conversionRate = when (item.originalCurrency) {
                            "USD" -> quote.conversions?.USD ?: 1.0
                            "EUR" -> quote.conversions?.EUR ?: 1.0
                            else -> quote.conversions?.TRY ?: 1.0
                        }

                        val convertedUnitPrice = newPrice * conversionRate
                        val totalPrice = newQty * convertedUnitPrice

                        item.copy(
                            quantity = newQty,
                            unitPrice = newPrice,
                            convertedUnitPrice = convertedUnitPrice,
                            totalPrice = totalPrice
                        )
                    } else item
                }
                r.copy(items = updatedItems)
            } else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun updateItemPublicName(companyId: String, id: String, roomId: String, itemId: String, publicName: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) {
                val updatedItems = r.items.map { item ->
                    if (item.id == itemId) item.copy(publicName = publicName) else item
                }
                r.copy(items = updatedItems)
            } else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun removeItem(companyId: String, id: String, roomId: String, itemId: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        val updatedRooms = quote.rooms.map { r ->
            if (r.id == roomId) {
                r.copy(items = r.items.filter { it.id != itemId })
            } else r
        }

        val updated = quote.copy(rooms = updatedRooms)
        return recalculateAndSave(companyId, updated)
    }

    suspend fun submitForApproval(companyId: String, id: String): Quote {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)

        if (quote.customerId == null) {
            throw AppError(HttpStatusCode.BadRequest, "Customer must be selected before submitting for approval.", "VALIDATION_ERROR")
        }
        if (quote.rooms.isEmpty() || !quote.rooms.any { it.items.isNotEmpty() }) {
            throw AppError(HttpStatusCode.BadRequest, "Quote must have at least one room with at least one product.", "VALIDATION_ERROR")
        }

        val updated = quote.copy(status = "sent_for_approval")
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun approveQuote(companyId: String, id: String): Quote {
        val quote = getQuote(companyId, id)
        if (quote.status != "sent_for_approval") {
            throw AppError(HttpStatusCode.BadRequest, "Only quotes sent for approval can be approved.", "INVALID_STATUS")
        }
        val updated = quote.copy(status = "approved")
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun denyQuote(companyId: String, id: String): Quote {
        val quote = getQuote(companyId, id)
        if (quote.status != "sent_for_approval") {
            throw AppError(HttpStatusCode.BadRequest, "Only quotes sent for approval can be denied.", "INVALID_STATUS")
        }
        val updated = quote.copy(status = "denied")
        return repo.updateQuote(companyId, updated) ?: updated
    }

    suspend fun listQuotes(companyId: String, userId: String, isAdmin: Boolean): List<Quote> {
        return repo.findAll(companyId, if (isAdmin) null else userId)
    }

    suspend fun deleteQuote(companyId: String, id: String) {
        val quote = getQuote(companyId, id)
        ensureEditable(quote)
        repo.delete(companyId, id)
    }
}

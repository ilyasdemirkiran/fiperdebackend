package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.quotes.Quote
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class QuoteRepository {
    private fun getCollection(companyId: String): MongoCollection<Quote> {
        return Database.getDatabaseForCompany(companyId).getCollection<Quote>("quotes")
    }

    suspend fun create(companyId: String, quote: Quote): Quote {
        val id = quote._id ?: ObjectId().toHexString()
        val created = quote.copy(_id = id)
        getCollection(companyId).insertOne(created)
        return created
    }

    suspend fun findById(companyId: String, id: String): Quote? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun findAll(companyId: String, creatorId: String? = null): List<Quote> {
        val filter = if (creatorId != null) Filters.eq("creatorId", creatorId) else Document()
        return getCollection(companyId).find(filter)
            .sort(Document("createdAt", -1))
            .toList()
    }

    suspend fun updateQuote(companyId: String, quote: Quote): Quote? {
        val id = quote._id ?: return null
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val updated = quote.copy(updatedAt = java.time.Instant.now().toString())

        getCollection(companyId).replaceOne(filter, updated)
        return updated
    }

    suspend fun delete(companyId: String, id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection(companyId).deleteOne(filter)
        return res.deletedCount > 0
    }

    suspend fun getNextQuoteNumber(companyId: String): String {
        val count = getCollection(companyId).countDocuments()
        val nextNumber = (count + 1).toString().padStart(4, '0')
        val year = java.time.LocalDate.now().year
        return "QT-$year-$nextNumber"
    }
}

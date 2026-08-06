package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.sales.PaymentLog
import com.ilyasdemirkiran.types.sales.Sale
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class SaleRepository {
    private fun getCollection(companyId: String): MongoCollection<Sale> {
        return Database.getDatabaseForCompany(companyId).getCollection<Sale>("sales")
    }

    suspend fun create(companyId: String, sale: Sale): Sale {
        val id = sale._id ?: ObjectId().toHexString()
        val created = sale.copy(_id = id)
        getCollection(companyId).insertOne(created)
        return created
    }

    suspend fun findById(companyId: String, id: String): Sale? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun findByCustomerId(companyId: String, customerId: String): List<Sale> {
        return getCollection(companyId).find(Filters.eq("customerId", customerId))
            .sort(Document("createdAt", -1))
            .toList()
    }

    suspend fun delete(companyId: String, id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection(companyId).deleteOne(filter)
        return res.deletedCount > 0
    }

    suspend fun addPaymentLog(companyId: String, saleId: String, log: PaymentLog): Sale? {
        val sale = findById(companyId, saleId) ?: return null
        val logId = log._id ?: ObjectId().toHexString()
        val newLog = log.copy(_id = logId, saleId = saleId)
        val newLogs = sale.logs + newLog
        val newPaid = sale.totalPaidAmount + log.amount
        val newStatus = if (newPaid >= sale.totalAmount) "completed" else "pending"

        val updated = sale.copy(
            logs = newLogs,
            totalPaidAmount = newPaid,
            status = newStatus,
            updatedAt = java.time.Instant.now().toString()
        )

        val filter = try { Filters.eq("_id", ObjectId(saleId)) } catch (e: Exception) { Filters.eq("_id", saleId) }
        getCollection(companyId).replaceOne(filter, updated)
        return updated
    }
}

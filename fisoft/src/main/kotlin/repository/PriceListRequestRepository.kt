package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.vendors.PriceListRequest
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class PriceListRequestRepository {
    private fun getCollection(): MongoCollection<PriceListRequest> {
        return Database.getGlobalVendorDatabase().getCollection<PriceListRequest>("price_list_requests")
    }

    suspend fun create(req: PriceListRequest): PriceListRequest {
        val id = req._id ?: ObjectId().toHexString()
        val created = req.copy(_id = id)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findById(id: String): PriceListRequest? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findAll(): List<PriceListRequest> {
        return getCollection().find()
            .sort(Document("createdAt", -1))
            .toList()
    }

    suspend fun updateStatus(id: String, status: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection().updateOne(filter, Updates.set("status", status))
        return res.modifiedCount > 0
    }
}

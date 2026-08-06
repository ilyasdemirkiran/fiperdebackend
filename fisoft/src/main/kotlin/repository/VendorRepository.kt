package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.vendors.Vendor
import com.mongodb.client.model.Filters
import com.mongodb.client.model.FindOneAndUpdateOptions
import com.mongodb.client.model.ReturnDocument
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class VendorRepository {
    private fun getCollection(): MongoCollection<Vendor> {
        return Database.getGlobalVendorDatabase().getCollection<Vendor>("vendors")
    }

    suspend fun create(vendor: Vendor): Vendor {
        val id = vendor._id ?: ObjectId().toHexString()
        val created = vendor.copy(_id = id)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findById(id: String): Vendor? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findAll(): List<Vendor> {
        return getCollection().find()
            .sort(Document("name", 1))
            .toList()
    }

    suspend fun findByIds(ids: List<String>): List<Vendor> {
        val objIds = ids.map { try { ObjectId(it) } catch (e: Exception) { it } }
        return getCollection().find(Filters.`in`("_id", objIds))
            .sort(Document("name", 1))
            .toList()
    }

    suspend fun update(id: String, name: String? = null, phone: String? = null, city: String? = null, district: String? = null, address: String? = null): Vendor? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val updates = mutableListOf<org.bson.conversions.Bson>()
        if (name != null) updates.add(Updates.set("name", name))
        if (phone != null) updates.add(Updates.set("phone", phone))
        if (city != null) updates.add(Updates.set("city", city))
        if (district != null) updates.add(Updates.set("district", district))
        if (address != null) updates.add(Updates.set("address", address))

        if (updates.isEmpty()) return findById(id)

        return getCollection().findOneAndUpdate(
            filter,
            Updates.combine(updates),
            FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER)
        )
    }

    suspend fun delete(id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection().deleteOne(filter)
        return res.deletedCount > 0
    }
}

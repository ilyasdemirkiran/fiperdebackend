package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.products.Product
import com.mongodb.client.model.Filters
import com.mongodb.client.model.FindOneAndUpdateOptions
import com.mongodb.client.model.ReturnDocument
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class ProductRepository {
    private fun getCollection(): MongoCollection<Product> {
        return Database.getGlobalVendorDatabase().getCollection<Product>("products")
    }

    suspend fun create(product: Product, vendorId: String): Product {
        val id = product._id ?: ObjectId().toHexString()
        val created = product.copy(_id = id, vendorId = vendorId)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findById(id: String): Product? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findByVendorIds(vendorIds: List<String>): List<Product> {
        val objIds = vendorIds.map { try { ObjectId(it) } catch (e: Exception) { it } }
        return getCollection().find(Filters.`in`("vendorId", objIds))
            .sort(Document("name", 1))
            .toList()
    }

    suspend fun findByVendorId(vendorId: String): List<Product> {
        val filter = try { Filters.eq("vendorId", ObjectId(vendorId)) } catch (e: Exception) { Filters.eq("vendorId", vendorId) }
        return getCollection().find(filter)
            .sort(Document("name", 1))
            .toList()
    }

    suspend fun update(id: String, name: String? = null, code: String? = null, price: Money? = null, currency: String? = null, description: String? = null, imageUrl: String? = null): Product? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val updates = mutableListOf<org.bson.conversions.Bson>()
        if (name != null) updates.add(Updates.set("name", name))
        if (code != null) updates.add(Updates.set("code", code))
        if (price != null) updates.add(Updates.set("price", price))
        if (currency != null) updates.add(Updates.set("currency", currency))
        if (description != null) updates.add(Updates.set("description", description))
        if (imageUrl != null) updates.add(Updates.set("imageUrl", imageUrl))
        updates.add(Updates.set("updatedAt", java.time.Instant.now().toString()))

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

    suspend fun deleteByVendorId(vendorId: String): Long {
        val filter = try { Filters.eq("vendorId", ObjectId(vendorId)) } catch (e: Exception) { Filters.eq("vendorId", vendorId) }
        val res = getCollection().deleteMany(filter)
        return res.deletedCount
    }
}

package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.customers.Customer
import com.mongodb.client.model.Filters
import com.mongodb.client.model.FindOneAndUpdateOptions
import com.mongodb.client.model.ReturnDocument
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class CustomerRepository {
    private fun getCollection(companyId: String): MongoCollection<Customer> {
        return Database.getDatabaseForCompany(companyId).getCollection<Customer>("customers")
    }

    suspend fun create(companyId: String, customer: Customer): Customer {
        val id = customer._id ?: ObjectId().toHexString()
        val created = customer.copy(_id = id)
        getCollection(companyId).insertOne(created)
        return created
    }

    suspend fun findById(companyId: String, id: String): Customer? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun getAll(companyId: String, status: String? = null): List<Customer> {
        val query = if (status != null) Filters.eq("status", status) else Document()
        return getCollection(companyId).find(query).toList()
    }

    suspend fun findAll(companyId: String, page: Int, limit: Int, status: String? = null, search: String? = null): Pair<List<Customer>, Long> {
        val filters = mutableListOf<org.bson.conversions.Bson>()
        if (status != null) filters.add(Filters.eq("status", status))
        if (!search.isNullOrEmpty()) {
            filters.add(
                Filters.or(
                    Filters.regex("name", search, "i"),
                    Filters.regex("surname", search, "i")
                )
            )
        }

        val filter = if (filters.isNotEmpty()) Filters.and(filters) else Document()
        val skip = (page - 1) * limit
        val collection = getCollection(companyId)

        val total = collection.countDocuments(filter)
        val customers = collection.find(filter)
            .sort(Document("createdAt", -1))
            .skip(skip)
            .limit(limit)
            .toList()

        return Pair(customers, total)
    }

    suspend fun update(companyId: String, id: String, name: String? = null, surname: String? = null, phone: String? = null, city: String? = null, district: String? = null, address: String? = null, status: String? = null): Customer? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val updates = mutableListOf<org.bson.conversions.Bson>()
        if (name != null) updates.add(Updates.set("name", name))
        if (surname != null) updates.add(Updates.set("surname", surname))
        if (phone != null) updates.add(Updates.set("phone", phone))
        if (city != null) updates.add(Updates.set("city", city))
        if (district != null) updates.add(Updates.set("district", district))
        if (address != null) updates.add(Updates.set("address", address))
        if (status != null) updates.add(Updates.set("status", status))

        if (updates.isEmpty()) return findById(companyId, id)

        return getCollection(companyId).findOneAndUpdate(
            filter,
            Updates.combine(updates),
            FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER)
        )
    }

    suspend fun delete(companyId: String, id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection(companyId).deleteOne(filter)
        return res.deletedCount > 0
    }

    suspend fun exists(companyId: String, id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val count = getCollection(companyId).countDocuments(filter)
        return count > 0
    }
}
package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.customers.CustomerImageLabel
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.types.ObjectId

class CustomerImageLabelRepository {
    private fun getCollection(companyId: String): MongoCollection<CustomerImageLabel> {
        return Database.getDatabaseForCompany(companyId).getCollection<CustomerImageLabel>("labels")
    }

    suspend fun create(companyId: String, name: String): CustomerImageLabel {
        val id = ObjectId().toHexString()
        val label = CustomerImageLabel(_id = id, name = name)
        getCollection(companyId).insertOne(label)
        return label
    }

    suspend fun findById(companyId: String, id: String): CustomerImageLabel? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun findAll(companyId: String): List<CustomerImageLabel> {
        return getCollection(companyId).find().toList()
    }

    suspend fun update(companyId: String, id: String, name: String): CustomerImageLabel? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val label = CustomerImageLabel(_id = id, name = name)
        getCollection(companyId).replaceOne(filter, label)
        return label
    }

    suspend fun delete(companyId: String, id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection(companyId).deleteOne(filter)
        return res.deletedCount > 0
    }
}

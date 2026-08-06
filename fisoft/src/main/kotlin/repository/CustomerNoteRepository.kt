package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.customers.CustomerNote
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId

class CustomerNoteRepository {
    private fun getCollection(companyId: String): MongoCollection<CustomerNote> {
        return Database.getDatabaseForCompany(companyId).getCollection<CustomerNote>("customer_notes")
    }

    suspend fun create(companyId: String, note: CustomerNote): CustomerNote {
        val id = note._id ?: ObjectId().toHexString()
        val created = note.copy(_id = id)
        getCollection(companyId).insertOne(created)
        return created
    }

    suspend fun findById(companyId: String, noteId: String): CustomerNote? {
        val filter = try { Filters.eq("_id", ObjectId(noteId)) } catch (e: Exception) { Filters.eq("_id", noteId) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun findByCustomerId(companyId: String, customerId: String): List<CustomerNote> {
        return getCollection(companyId).find(Filters.eq("customerId", customerId))
            .sort(Document("createdAt", -1))
            .toList()
    }

    suspend fun update(companyId: String, noteId: String, noteText: String): CustomerNote? {
        val filter = try { Filters.eq("_id", ObjectId(noteId)) } catch (e: Exception) { Filters.eq("_id", noteId) }
        getCollection(companyId).updateOne(filter, Updates.set("note", noteText))
        return findById(companyId, noteId)
    }

    suspend fun delete(companyId: String, noteId: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(noteId)) } catch (e: Exception) { Filters.eq("_id", noteId) }
        val res = getCollection(companyId).deleteOne(filter)
        return res.deletedCount > 0
    }
}

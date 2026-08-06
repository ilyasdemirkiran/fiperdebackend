package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.UserRole
import com.mongodb.client.model.Filters
import com.mongodb.client.model.FindOneAndUpdateOptions
import com.mongodb.client.model.ReturnDocument
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList

class UserRepository {
    private fun getCollection(): MongoCollection<FIUser> {
        return Database.getCoreDatabase().getCollection<FIUser>("users")
    }

    suspend fun create(user: FIUser): FIUser {
        getCollection().insertOne(user)
        return user
    }

    suspend fun findById(id: String): FIUser? {
        return getCollection().find(Filters.eq("_id", id)).firstOrNull()
    }

    suspend fun findByPhoneNumber(phoneNumber: String): FIUser? {
        return getCollection().find(Filters.eq("phoneNumber", phoneNumber)).firstOrNull()
    }

    suspend fun findByCompanyId(companyId: String): List<FIUser> {
        return getCollection().find(Filters.eq("companyId", companyId))
            .toList()
            .filter { it.role != UserRole.sudo }
    }

    suspend fun update(id: String, name: String? = null, surname: String? = null, companyId: String? = null, role: UserRole? = null): FIUser? {
        val updates = mutableListOf<org.bson.conversions.Bson>()
        if (name != null) updates.add(Updates.set("name", name))
        if (surname != null) updates.add(Updates.set("surname", surname))
        if (companyId != null) updates.add(Updates.set("companyId", companyId))
        if (role != null) updates.add(Updates.set("role", role.name))

        if (updates.isEmpty()) return findById(id)

        return getCollection().findOneAndUpdate(
            Filters.eq("_id", id),
            Updates.combine(updates),
            FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER)
        )
    }

    suspend fun delete(id: String): Boolean {
        val res = getCollection().deleteOne(Filters.eq("_id", id))
        return res.deletedCount > 0
    }
}

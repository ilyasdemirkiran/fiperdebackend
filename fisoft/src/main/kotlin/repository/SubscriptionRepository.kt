package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.subscription.Subscription
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import org.bson.types.ObjectId

class SubscriptionRepository {
    private fun getCollection(): MongoCollection<Subscription> {
        return Database.getCoreDatabase().getCollection<Subscription>("subscriptions")
    }

    suspend fun create(sub: Subscription): Subscription {
        val id = sub._id ?: ObjectId().toHexString()
        val created = sub.copy(_id = id)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findByCompanyId(companyId: String): Subscription? {
        return getCollection().find(Filters.eq("companyId", companyId)).firstOrNull()
    }

    suspend fun delete(companyId: String): Boolean {
        val res = getCollection().deleteOne(Filters.eq("companyId", companyId))
        return res.deletedCount > 0
    }
}

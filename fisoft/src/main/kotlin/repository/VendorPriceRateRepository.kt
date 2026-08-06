package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.vendors.VendorPriceRate
import com.mongodb.client.model.Filters
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.toList
import org.bson.types.ObjectId

class VendorPriceRateRepository {
    private fun getCollection(companyId: String): MongoCollection<VendorPriceRate> {
        return Database.getDatabaseForCompany(companyId).getCollection<VendorPriceRate>("vendor_price_rates")
    }

    suspend fun findByVendorIds(companyId: String, vendorIds: List<String>): List<VendorPriceRate> {
        val objIds = vendorIds.map { try { ObjectId(it) } catch (e: Exception) { it } }
        return getCollection(companyId).find(Filters.`in`("vendorId", objIds)).toList()
    }

    suspend fun upsertRate(companyId: String, vendorId: String, rate: Double): VendorPriceRate {
        val vObjId = try { ObjectId(vendorId) } catch (e: Exception) { vendorId }
        val filter = Filters.eq("vendorId", vObjId)
        val update = Updates.combine(
            Updates.set("rate", rate),
            Updates.set("updatedAt", java.time.Instant.now().toString())
        )
        val options = UpdateOptions().upsert(true)
        getCollection(companyId).updateOne(filter, update, options)

        return VendorPriceRate(
            companyId = companyId,
            vendorId = vendorId,
            rate = rate,
            updatedAt = java.time.Instant.now().toString()
        )
    }
}

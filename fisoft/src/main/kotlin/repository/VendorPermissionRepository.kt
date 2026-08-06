package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.vendors.VendorPermission
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.toList
import org.bson.types.ObjectId

class VendorPermissionRepository {
    private fun getCollection(): MongoCollection<VendorPermission> {
        return Database.getGlobalVendorDatabase().getCollection<VendorPermission>("vendor_permissions")
    }

    suspend fun addPermission(vendorId: String, companyId: String): VendorPermission {
        val id = ObjectId().toHexString()
        val perm = VendorPermission(_id = id, companyId = companyId, vendorId = vendorId, grantedAt = java.time.Instant.now().toString())
        getCollection().insertOne(perm)
        return perm
    }

    suspend fun removePermission(vendorId: String, companyId: String): Boolean {
        val cObjId = try { ObjectId(companyId) } catch (e: Exception) { companyId }
        val vObjId = try { ObjectId(vendorId) } catch (e: Exception) { vendorId }

        val filter = Filters.and(
            Filters.or(Filters.eq("companyId", cObjId), Filters.eq("companyId", companyId)),
            Filters.or(Filters.eq("vendorId", vObjId), Filters.eq("vendorId", vendorId))
        )
        val res = getCollection().deleteOne(filter)
        return res.deletedCount > 0
    }

    suspend fun getVendorIdsForCompany(companyId: String): List<String> {
        val cObjId = try { ObjectId(companyId) } catch (e: Exception) { companyId }
        val filter = Filters.or(Filters.eq("companyId", cObjId), Filters.eq("companyId", companyId))
        return getCollection().find(filter)
            .toList()
            .mapNotNull { it.vendorId }
    }

    suspend fun getCompanyIdsForVendor(vendorId: String): List<String> {
        val vObjId = try { ObjectId(vendorId) } catch (e: Exception) { vendorId }
        val filter = Filters.or(Filters.eq("vendorId", vObjId), Filters.eq("vendorId", vendorId))
        return getCollection().find(filter)
            .toList()
            .mapNotNull { it.companyId }
    }

    suspend fun hasPermission(vendorId: String, companyId: String): Boolean {
        val cObjId = try { ObjectId(companyId) } catch (e: Exception) { companyId }
        val vObjId = try { ObjectId(vendorId) } catch (e: Exception) { vendorId }

        val filter = Filters.and(
            Filters.or(Filters.eq("companyId", cObjId), Filters.eq("companyId", companyId)),
            Filters.or(Filters.eq("vendorId", vObjId), Filters.eq("vendorId", vendorId))
        )
        val count = getCollection().countDocuments(filter)
        return count > 0
    }

    suspend fun findAll(): List<VendorPermission> {
        return getCollection().find().toList()
    }
}

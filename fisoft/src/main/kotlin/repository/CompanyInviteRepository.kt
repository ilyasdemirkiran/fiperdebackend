package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.companies.CompanyInvite
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.types.ObjectId

class CompanyInviteRepository {
    private fun getCollection(): MongoCollection<CompanyInvite> {
        return Database.getCoreDatabase().getCollection<CompanyInvite>("company_invites")
    }

    suspend fun create(invite: CompanyInvite): CompanyInvite {
        val id = invite._id ?: ObjectId().toHexString()
        val created = invite.copy(_id = id)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findById(id: String): CompanyInvite? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findByCompanyId(companyId: String): List<CompanyInvite> {
        val cObjId = try { ObjectId(companyId) } catch (e: Exception) { companyId }
        val filter = try { Filters.eq("companyId", cObjId) } catch (e: Exception) { Filters.eq("companyId", companyId) }
        return getCollection().find(filter).toList()
    }

    suspend fun findByInvitedUserIdOrPhone(userId: String, phone: String?): List<CompanyInvite> {
        val userFilters = mutableListOf(Filters.eq("invitedUserId", userId))
        if (!phone.isNullOrBlank()) {
            userFilters.add(Filters.eq("invitedPhoneNumber", phone))
        }

        val filter = Filters.and(
            Filters.or(userFilters),
            Filters.eq("status", "pending")
        )
        return getCollection().find(filter).toList()
    }

    suspend fun updateStatus(id: String, status: String) {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        getCollection().updateOne(filter, Updates.set("status", status))
    }

    suspend fun delete(id: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection().deleteOne(filter)
        return res.deletedCount > 0
    }
}

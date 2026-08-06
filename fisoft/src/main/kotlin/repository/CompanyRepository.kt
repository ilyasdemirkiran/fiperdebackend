package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.companies.Company
import com.mongodb.client.gridfs.model.GridFSUploadOptions
import com.mongodb.client.model.Filters
import com.mongodb.client.model.FindOneAndUpdateOptions
import com.mongodb.client.model.ReturnDocument
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class CompanyRepository {
    private fun getCollection(): MongoCollection<Company> {
        return Database.getCoreDatabase().getCollection<Company>("companies")
    }

    suspend fun create(company: Company): Company {
        val id = company._id ?: ObjectId().toHexString()
        val created = company.copy(_id = id)
        getCollection().insertOne(created)
        return created
    }

    suspend fun findById(id: String): Company? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findByIds(ids: List<String>): List<Company> {
        val objIds = ids.map { try { ObjectId(it) } catch (e: Exception) { it } }
        return getCollection().find(Filters.`in`("_id", objIds)).toList()
    }

    suspend fun addUser(companyId: String, userId: String) {
        val filter = try { Filters.eq("_id", ObjectId(companyId)) } catch (e: Exception) { Filters.eq("_id", companyId) }
        getCollection().updateOne(filter, Updates.addToSet("userIds", userId))
    }

    suspend fun removeUser(companyId: String, userId: String) {
        val filter = try { Filters.eq("_id", ObjectId(companyId)) } catch (e: Exception) { Filters.eq("_id", companyId) }
        getCollection().updateOne(filter, Updates.pull("userIds", userId))
    }

    suspend fun update(companyId: String, name: String? = null, logoOriginalFileId: String? = null, logoMiniFileId: String? = null): Company? {
        val filter = try { Filters.eq("_id", ObjectId(companyId)) } catch (e: Exception) { Filters.eq("_id", companyId) }
        val updates = mutableListOf<org.bson.conversions.Bson>()
        if (name != null) updates.add(Updates.set("name", name))
        if (logoOriginalFileId != null) updates.add(Updates.set("logoOriginalFileId", logoOriginalFileId))
        if (logoMiniFileId != null) updates.add(Updates.set("logoMiniFileId", logoMiniFileId))

        if (updates.isEmpty()) return findById(companyId)

        return getCollection().findOneAndUpdate(
            filter,
            Updates.combine(updates),
            FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER)
        )
    }

    suspend fun delete(companyId: String): Boolean {
        val filter = try { Filters.eq("_id", ObjectId(companyId)) } catch (e: Exception) { Filters.eq("_id", companyId) }
        val res = getCollection().deleteOne(filter)
        return res.deletedCount > 0
    }

    fun uploadLogoToGridFS(companyId: String, filename: String, data: ByteArray, mimeType: String): String {
        val bucket = Database.getGridFSBucket(companyId, "logos")
        val options = GridFSUploadOptions().metadata(Document("mimeType", mimeType))
        val stream = ByteArrayInputStream(data)
        val fileId = bucket.uploadFromStream(filename, stream, options)
        return fileId.toHexString()
    }

    fun downloadLogoFromGridFS(companyId: String, fileId: String): Pair<ByteArray, String> {
        val bucket = Database.getGridFSBucket(companyId, "logos")
        val objId = ObjectId(fileId)
        val filesDoc = bucket.find(Filters.eq("_id", objId)).first()
        val mimeType = filesDoc?.metadata?.getString("mimeType") ?: "image/png"

        val out = ByteArrayOutputStream()
        bucket.downloadToStream(objId, out)
        return Pair(out.toByteArray(), mimeType)
    }

    fun deleteLogoFromGridFS(companyId: String, fileId: String) {
        try {
            val bucket = Database.getGridFSBucket(companyId, "logos")
            bucket.delete(ObjectId(fileId))
        } catch (e: Exception) {
            // ignore if deleted
        }
    }
}
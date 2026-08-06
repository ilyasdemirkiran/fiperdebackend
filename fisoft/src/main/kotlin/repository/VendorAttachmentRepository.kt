package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.vendors.VendorDocument
import com.mongodb.client.gridfs.model.GridFSUploadOptions
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class VendorAttachmentRepository {
    private fun getCollection(): MongoCollection<VendorDocument> {
        return Database.getGlobalVendorDatabase().getCollection<VendorDocument>("vendor_attachments")
    }

    private fun getGridFSBucket() = Database.getGridFSBucket("global_vendors", "vendor_attachments")

    fun uploadToGridFS(filename: String, data: ByteArray, mimeType: String): String {
        val bucket = getGridFSBucket()
        val options = GridFSUploadOptions().metadata(Document("mimeType", mimeType))
        val stream = ByteArrayInputStream(data)
        val fileId = bucket.uploadFromStream(filename, stream, options)
        return fileId.toHexString()
    }

    fun downloadFromGridFS(fileId: String): Pair<ByteArray, String> {
        val bucket = getGridFSBucket()
        val objId = ObjectId(fileId)
        val filesDoc = bucket.find(Filters.eq("_id", objId)).firstOrNull()
        val mimeType = filesDoc?.metadata?.getString("mimeType") ?: "application/pdf"

        val out = ByteArrayOutputStream()
        bucket.downloadToStream(objId, out)
        return Pair(out.toByteArray(), mimeType)
    }

    fun deleteFromGridFS(fileId: String) {
        try {
            val bucket = getGridFSBucket()
            bucket.delete(ObjectId(fileId))
        } catch (e: Exception) {
            // ignore if already deleted
        }
    }

    suspend fun create(doc: VendorDocument): VendorDocument {
        val id = doc._id ?: ObjectId().toHexString()
        val toInsert = doc.copy(_id = id)
        getCollection().insertOne(toInsert)
        return toInsert
    }

    suspend fun findById(id: String): VendorDocument? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection().find(filter).firstOrNull()
    }

    suspend fun findByVendorId(vendorId: String): List<VendorDocument> {
        val vObjId = try { ObjectId(vendorId) } catch (e: Exception) { vendorId }
        val filter = try { Filters.eq("vendorId", vObjId) } catch (e: Exception) { Filters.eq("vendorId", vendorId) }
        return getCollection().find(filter).sort(Document("uploadedAt", -1)).toList()
    }

    suspend fun update(id: String, title: String?, description: String?): VendorDocument? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val existing = getCollection().find(filter).firstOrNull() ?: return null
        val updated = existing.copy(
            title = title ?: existing.title
        )
        getCollection().replaceOne(filter, updated)
        return updated
    }

    suspend fun delete(id: String): Boolean {
        val doc = findById(id) ?: return false
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        val res = getCollection().deleteOne(filter)
        if (res.deletedCount > 0) {
            if (doc.fileId != null) {
                deleteFromGridFS(doc.fileId)
            }
            return true
        }
        return false
    }

    suspend fun deleteByVendorId(vendorId: String): Long {
        val docs = findByVendorId(vendorId)
        for (doc in docs) {
            if (doc._id != null) delete(doc._id)
        }
        return docs.size.toLong()
    }
}

package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.types.customers.Customer
import com.ilyasdemirkiran.types.customers.CustomerImage
import com.mongodb.client.gridfs.model.GridFSUploadOptions
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoCollection
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.types.ObjectId
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class CustomerImageRepository {
    private fun getCollection(companyId: String): MongoCollection<CustomerImage> {
        return Database.getDatabaseForCompany(companyId).getCollection<CustomerImage>("customer_images")
    }

    fun uploadToGridFS(companyId: String, filename: String, data: ByteArray, mimeType: String): String {
        val bucket = Database.getGridFSBucket(companyId, "images")
        val options = GridFSUploadOptions().metadata(Document("mimeType", mimeType))
        val stream = ByteArrayInputStream(data)
        val fileId = bucket.uploadFromStream(filename, stream, options)
        return fileId.toHexString()
    }

    fun downloadFromGridFS(companyId: String, fileId: String): Pair<ByteArray, String> {
        val bucket = Database.getGridFSBucket(companyId, "images")
        val objId = ObjectId(fileId)
        val filesDoc = bucket.find(Filters.eq("_id", objId)).firstOrNull()
        val mimeType = filesDoc?.metadata?.getString("mimeType") ?: "image/jpeg"

        val out = ByteArrayOutputStream()
        bucket.downloadToStream(objId, out)
        return Pair(out.toByteArray(), mimeType)
    }

    fun deleteFromGridFS(companyId: String, fileId: String) {
        try {
            val bucket = Database.getGridFSBucket(companyId, "images")
            bucket.delete(ObjectId(fileId))
        } catch (e: Exception) {
            // ignore if deleted
        }
    }

    suspend fun create(companyId: String, image: CustomerImage, fileId: String): CustomerImage {
        val id = image._id ?: ObjectId().toHexString()
        val created = image.copy(_id = id, originalFileId = fileId)
        getCollection(companyId).insertOne(created)

        // Increment customer imageCount
        if (!image.customerId.isNullOrEmpty()) {
            val filter = try { Filters.eq("_id", ObjectId(image.customerId)) } catch (e: Exception) { Filters.eq("_id", image.customerId) }
            Database.getDatabaseForCompany(companyId).getCollection<Customer>("customers")
                .updateOne(filter, Updates.inc("imageCount", 1))
        }

        return created
    }

    suspend fun findById(companyId: String, id: String): CustomerImage? {
        val filter = try { Filters.eq("_id", ObjectId(id)) } catch (e: Exception) { Filters.eq("_id", id) }
        return getCollection(companyId).find(filter).firstOrNull()
    }

    suspend fun findAll(companyId: String): List<CustomerImage> {
        return getCollection(companyId).find().sort(Document("uploadedAt", -1)).toList()
    }

    suspend fun findByCustomerId(companyId: String, customerId: String): List<CustomerImage> {
        return getCollection(companyId).find(Filters.eq("customerId", customerId))
            .sort(Document("uploadedAt", -1))
            .toList()
    }

    suspend fun findByLabels(companyId: String, labelIds: List<String>): List<CustomerImage> {
        if (labelIds.isEmpty()) return findAll(companyId)
        return getCollection(companyId).find(Filters.`in`("labels", labelIds))
            .sort(Document("uploadedAt", -1))
            .toList()
    }

    suspend fun updateLabels(companyId: String, imageId: String, labels: List<String>): CustomerImage? {
        val filter = try { Filters.eq("_id", ObjectId(imageId)) } catch (e: Exception) { Filters.eq("_id", imageId) }
        val existing = findById(companyId, imageId) ?: return null
        val updated = existing.copy(labels = labels)
        getCollection(companyId).replaceOne(filter, updated)
        return updated
    }

    suspend fun delete(companyId: String, imageId: String): Boolean {
        val image = findById(companyId, imageId) ?: return false
        val filter = try { Filters.eq("_id", ObjectId(imageId)) } catch (e: Exception) { Filters.eq("_id", imageId) }
        val res = getCollection(companyId).deleteOne(filter)
        if (res.deletedCount > 0) {
            if (image.originalFileId != null) deleteFromGridFS(companyId, image.originalFileId)
            if (image.miniFileId != null) {
                deleteFromGridFS(companyId, image.miniFileId)
            }
            if (!image.customerId.isNullOrEmpty()) {
                val custFilter = try { Filters.eq("_id", ObjectId(image.customerId)) } catch (e: Exception) { Filters.eq("_id", image.customerId) }
                Database.getDatabaseForCompany(companyId).getCollection<Customer>("customers")
                    .updateOne(custFilter, Updates.inc("imageCount", -1))
            }
            return true
        }
        return false
    }
}

package com.ilyasdemirkiran.utils

import com.ilyasdemirkiran.config.Database
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.bson.Document
import org.bson.types.ObjectId

/**
 * Migration: Convert all String ID fields to ObjectId across all databases.
 *
 * Covers:
 * - fiperde_core: companies, company_invites, company_notes, users
 * - vendors_global: vendors, products, vendor_attachments, vendor_permissions, vendor_price_rates, price_list_requests
 * - fi_*: customers, customer_images, customer_notes, labels, sales, quotes, subscriptions
 */
object ObjectIdMigration {

    // Map of collection name -> list of fields that should be ObjectId
    private val collectionIdFields: Map<String, List<String>> = mapOf(
        // fiperde_core
        "companies" to listOf("creatorUserId", "logoOriginalFileId", "logoMiniFileId"),
        "company_invites" to listOf("companyId", "creatorUserId", "invitedUserId"),
        "company_notes" to listOf("companyId", "userId"),

        // vendors_global
        "products" to listOf("vendorId"),
        "vendor_attachments" to listOf("vendorId", "fileId"),
        "vendor_permissions" to listOf("companyId", "vendorId"),
        "vendor_price_rates" to listOf("companyId", "vendorId"),
        "price_list_requests" to listOf("companyId", "vendorId"),

        // fi_* (company databases)
        "customers" to emptyList(),
        "customer_images" to listOf("customerId", "originalFileId", "miniFileId"),
        "customer_notes" to listOf("customerId", "userId"),
        "labels" to emptyList(),
        "sales" to listOf("customerId", "createdByUserId"),
        "quotes" to listOf("companyId", "customerId", "creatorId"),
        "subscriptions" to listOf("companyId")
    )

    // Fields inside nested arrays/objects
    private val nestedIdFields: Map<String, Map<String, List<String>>> = mapOf(
        "sales" to mapOf(
            "logs" to listOf("saleId", "customerId", "createdByUserId")
        ),
        "quotes" to mapOf(
            "rooms.items" to listOf("productId")
        )
    )

    /**
     * Check if a value is a valid 24-char hex string that can be an ObjectId
     */
    private fun isObjectIdString(value: Any?): Boolean {
        if (value !is String) return false
        if (value.length != 24) return false
        return value.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }
    }

    /**
     * Convert string ID fields to ObjectId for a single document
     */
    private fun buildUpdates(doc: Document, fields: List<String>): List<org.bson.conversions.Bson> {
        val updates = mutableListOf<org.bson.conversions.Bson>()

        for (field in fields) {
            val value = doc.get(field)
            if (isObjectIdString(value)) {
                updates.add(Updates.set(field, ObjectId(value as String)))
            }
        }

        return updates
    }

    /**
     * Process nested array fields (e.g. sales.logs, quotes.rooms.items)
     */
    private fun buildNestedUpdates(
        doc: Document,
        collName: String
    ): List<org.bson.conversions.Bson> {
        val updates = mutableListOf<org.bson.conversions.Bson>()
        val nestedConfig = nestedIdFields[collName] ?: return updates

        for ((path, fields) in nestedConfig) {
            when {
                // Handle sales.logs (single-level array)
                path == "logs" -> {
                    val logs = doc.getList("logs", Document::class.java) ?: continue
                    var changed = false
                    for (log in logs) {
                        for (field in fields) {
                            val value = log.get(field)
                            if (isObjectIdString(value)) {
                                log[field] = ObjectId(value as String)
                                changed = true
                            }
                        }
                        // Also convert _id of nested log if it's a string
                        val logId = log.get("_id")
                        if (isObjectIdString(logId)) {
                            log["_id"] = ObjectId(logId as String)
                            changed = true
                        }
                    }
                    if (changed) {
                        updates.add(Updates.set("logs", logs))
                    }
                }
                // Handle quotes.rooms.items (two-level nested array)
                path == "rooms.items" -> {
                    val rooms = doc.getList("rooms", Document::class.java) ?: continue
                    var changed = false
                    for (room in rooms) {
                        val items = room.getList("items", Document::class.java) ?: continue
                        for (item in items) {
                            for (field in fields) {
                                val value = item.get(field)
                                if (isObjectIdString(value)) {
                                    item[field] = ObjectId(value as String)
                                    changed = true
                                }
                            }
                        }
                    }
                    if (changed) {
                        updates.add(Updates.set("rooms", rooms))
                    }
                }
            }
        }

        return updates
    }

    /**
     * Also convert _id if it's stored as a string (unlikely but safety)
     */
    private fun buildIdUpdate(doc: Document): org.bson.conversions.Bson? {
        // _id should already be ObjectId in most cases, skip
        return null
    }

    /**
     * Convert userIds array in companies collection (array of strings -> array of ObjectIds)
     */
    private fun buildUserIdsUpdate(doc: Document, collName: String): List<org.bson.conversions.Bson> {
        val updates = mutableListOf<org.bson.conversions.Bson>()

        if (collName == "companies") {
            val userIds = doc.getList("userIds", String::class.java)
            if (userIds != null && userIds.isNotEmpty()) {
                val converted = userIds.map { uid ->
                    if (isObjectIdString(uid)) ObjectId(uid) else uid
                }
                if (converted != userIds) {
                    updates.add(Updates.set("userIds", converted))
                }
            }
        }

        return updates
    }

    suspend fun runMigration() {
        println("🚀 Starting ObjectId Migration...")
        Database.connect()

        val client = Database.getCoroutineClient()
        val dbNames = client.listDatabaseNames().toList().filter { name ->
            name == "fiperde_core" || name == "vendors_global" || name.startsWith("fi_")
        }

        var totalUpdatedDocuments = 0
        var totalSkippedDocuments = 0

        for (dbName in dbNames) {
            println("📂 Processing database: $dbName")
            val db = client.getDatabase(dbName)
            val collections = db.listCollectionNames().toList().filter {
                !it.endsWith(".chunks") && !it.endsWith(".files")
            }

            for (collName in collections) {
                val fields = collectionIdFields[collName] ?: continue
                val collection = db.getCollection<Document>(collName)
                val docs = collection.find().toList()

                var collUpdated = 0

                for (doc in docs) {
                    val id = doc.get("_id") ?: continue
                    val allUpdates = mutableListOf<org.bson.conversions.Bson>()

                    // Top-level field conversions
                    allUpdates.addAll(buildUpdates(doc, fields))

                    // Nested array field conversions
                    allUpdates.addAll(buildNestedUpdates(doc, collName))

                    // userIds array in companies
                    allUpdates.addAll(buildUserIdsUpdate(doc, collName))

                    if (allUpdates.isNotEmpty()) {
                        try {
                            collection.updateOne(Filters.eq("_id", id), Updates.combine(allUpdates))
                            collUpdated++
                            totalUpdatedDocuments++
                        } catch (e: Exception) {
                            println("  ⚠️ Error updating doc $id in $dbName.$collName: ${e.message}")
                        }
                    } else {
                        totalSkippedDocuments++
                    }
                }

                if (collUpdated > 0) {
                    println("  ✅ $collName: $collUpdated documents updated")
                }
            }
        }

        println("✅ ObjectId Migration Completed!")
        println("   Total documents updated: $totalUpdatedDocuments")
        println("   Total documents skipped (already ObjectId): $totalSkippedDocuments")
    }
}

fun main() = runBlocking {
    ObjectIdMigration.runMigration()
    Database.close()
}

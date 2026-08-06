package com.ilyasdemirkiran.utils

import com.ilyasdemirkiran.config.Database
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.bson.Document
import java.time.Instant

object TimestampMigration {

    private val DATE_FIELD_NAMES = setOf(
        "createdAt",
        "updatedAt",
        "uploadedAt",
        "expiresAt",
        "subscriptionStartDate",
        "subscriptionEndDate"
    )

    fun normalizeToIsoString(value: Any?): String? {
        if (value == null) return null
        return when (value) {
            is String -> {
                if (value.isBlank()) null
                else if (value.contains("T")) value
                else try {
                    Instant.parse(value).toString()
                } catch (e: Exception) {
                    value
                }
            }
            is java.util.Date -> value.toInstant().toString()
            is Document -> {
                val secObj = value.get("_seconds") ?: value.get("seconds")
                val seconds = when (secObj) {
                    is Number -> secObj.toLong()
                    is String -> secObj.toLongOrNull()
                    else -> null
                }
                if (seconds != null) {
                    Instant.ofEpochSecond(seconds).toString()
                } else {
                    value.toString()
                }
            }
            is Number -> try {
                Instant.ofEpochMilli(value.toLong()).toString()
            } catch (e: Exception) {
                value.toString()
            }
            else -> value.toString()
        }
    }

    suspend fun runMigration() {
        println("🚀 Starting MongoDB Timestamp Normalization Migration...")
        Database.connect()

        val client = Database.getCoroutineClient()
        val dbNames = client.listDatabaseNames().toList().filter { name ->
            name == "fiperde_core" || name == "vendors_global" || name.startsWith("fi_")
        }

        println("📂 Found ${dbNames.size} target database(s): $dbNames")
        var totalUpdatedDocuments = 0

        for (dbName in dbNames) {
            val db = client.getDatabase(dbName)
            val collections = db.listCollectionNames().toList().filter { !it.endsWith(".chunks") && !it.endsWith(".files") }

            for (collName in collections) {
                val collection = db.getCollection<Document>(collName)
                val cursor = collection.find().toList()

                for (doc in cursor) {
                    val id = doc.get("_id") ?: continue
                    val updates = mutableListOf<org.bson.conversions.Bson>()

                    for (field in DATE_FIELD_NAMES) {
                        if (doc.containsKey(field)) {
                            val rawVal = doc.get(field)
                            val normalized = normalizeToIsoString(rawVal)
                            if (normalized != null && normalized != rawVal) {
                                updates.add(Updates.set(field, normalized))
                            }
                        }
                    }

                    // Handle paymentLogs array in sales collection
                    if (collName == "sales" && doc.containsKey("paymentLogs")) {
                        val logs = doc.getList("paymentLogs", Document::class.java)
                        if (!logs.isNullOrEmpty()) {
                            var modified = false
                            val newLogs = logs.map { logDoc ->
                                if (logDoc.containsKey("createdAt")) {
                                    val rawVal = logDoc.get("createdAt")
                                    val normalized = normalizeToIsoString(rawVal)
                                    if (normalized != null && normalized != rawVal) {
                                        logDoc.append("createdAt", normalized)
                                        modified = true
                                    }
                                }
                                logDoc
                            }
                            if (modified) {
                                updates.add(Updates.set("paymentLogs", newLogs))
                            }
                        }
                    }

                    if (updates.isNotEmpty()) {
                        val filter = Filters.eq("_id", id)
                        collection.updateOne(filter, Updates.combine(updates))
                        totalUpdatedDocuments++
                    }
                }
            }
        }

        println("✅ Timestamp Migration Completed! Total documents updated: $totalUpdatedDocuments")
    }
}

fun main() = runBlocking {
    TimestampMigration.runMigration()
    Database.close()
}

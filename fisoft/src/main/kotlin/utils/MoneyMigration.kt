package com.ilyasdemirkiran.utils

import com.ilyasdemirkiran.config.Database
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.bson.Document

object MoneyMigration {

    private fun normalizeMoneyValue(raw: Any?): Long? {
        if (raw == null) return null
        return when (raw) {
            is Double -> Math.round(raw)
            is Float -> Math.round(raw.toDouble())
            is Int -> raw.toLong()
            is Long -> raw
            is Number -> raw.toLong()
            is String -> {
                val d = raw.toDoubleOrNull()
                if (d != null) Math.round(d) else null
            }
            else -> null
        }
    }

    suspend fun runMigration() {
        println("🚀 Starting MongoDB Money Normalization Migration...")
        Database.connect()

        val client = Database.getCoroutineClient()
        val dbNames = client.listDatabaseNames().toList().filter { name ->
            name == "fiperde_core" || name == "vendors_global" || name.startsWith("fi_")
        }

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

                    if (collName == "products") {
                        val p = doc.get("price")
                        val pNorm = normalizeMoneyValue(p)
                        if (pNorm != null && pNorm != p) updates.add(Updates.set("price", pNorm))

                        val pr = doc.get("priceWithRate")
                        val prNorm = normalizeMoneyValue(pr)
                        if (prNorm != null && prNorm != pr) updates.add(Updates.set("priceWithRate", prNorm))
                    }

                    if (collName == "sales") {
                        val ta = doc.get("totalAmount")
                        val taNorm = normalizeMoneyValue(ta)
                        if (taNorm != null && taNorm != ta) updates.add(Updates.set("totalAmount", taNorm))

                        val tp = doc.get("totalPaidAmount")
                        val tpNorm = normalizeMoneyValue(tp)
                        if (tpNorm != null && tpNorm != tp) updates.add(Updates.set("totalPaidAmount", tpNorm))
                    }

                    if (collName == "quotes") {
                        val t = doc.get("total")
                        val tNorm = normalizeMoneyValue(t)
                        if (tNorm != null && tNorm != t) updates.add(Updates.set("total", tNorm))

                        val td = doc.get("totalAfterDiscount")
                        val tdNorm = normalizeMoneyValue(td)
                        if (tdNorm != null && tdNorm != td) updates.add(Updates.set("totalAfterDiscount", tdNorm))
                    }

                    if (collName == "subscriptions") {
                        val p = doc.get("paytrPaymentAmount")
                        val pNorm = normalizeMoneyValue(p)
                        if (pNorm != null && pNorm != p) updates.add(Updates.set("paytrPaymentAmount", pNorm))
                    }

                    if (updates.isNotEmpty()) {
                        collection.updateOne(Filters.eq("_id", id), Updates.combine(updates))
                        totalUpdatedDocuments++
                    }
                }
            }
        }

        println("✅ Money Normalization Migration Completed! Total documents updated: $totalUpdatedDocuments")
    }
}

fun main() = runBlocking {
    MoneyMigration.runMigration()
    Database.close()
}

package com.ilyasdemirkiran.config

import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.client.MongoClient as SyncMongoClient
import com.mongodb.client.MongoClients as SyncMongoClients
import com.mongodb.client.MongoDatabase as SyncMongoDatabase
import com.mongodb.client.gridfs.GridFSBucket
import com.mongodb.client.gridfs.GridFSBuckets
import com.mongodb.kotlin.client.coroutine.MongoClient as CoroutineMongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase as CoroutineMongoDatabase
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.bson.Document
import org.bson.codecs.configuration.CodecRegistries
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

object Database {
    private var coroutineClient: CoroutineMongoClient? = null
    private var syncClient: SyncMongoClient? = null

    private val dbCache = ConcurrentHashMap<String, CoroutineMongoDatabase>()
    private val syncDbCache = ConcurrentHashMap<String, SyncMongoDatabase>()
    private val gridFSCache = ConcurrentHashMap<String, GridFSBucket>()

    fun connect() {
        if (coroutineClient != null) return

        val uri = Environment.MONGODB_URI
        val user = Environment.MONGO_ROOT_USERNAME
        val pass = Environment.MONGO_ROOT_PASSWORD

        println("🔌 Connecting to MongoDB at $uri...")

        // Register MoneyCodecProvider before the default codecs so Money is resolved first
        val moneyRegistry = CodecRegistries.fromProviders(MoneyCodecProvider())

        val builder = MongoClientSettings.builder()
            .applyConnectionString(ConnectionString(uri))
            .codecRegistry(
                CodecRegistries.fromRegistries(
                    moneyRegistry,
                    MongoClientSettings.getDefaultCodecRegistry()
                )
            )
            .applyToSocketSettings { s ->
                s.connectTimeout(5000, TimeUnit.MILLISECONDS)
            }
            .applyToClusterSettings { c ->
                c.serverSelectionTimeout(5000, TimeUnit.MILLISECONDS)
            }

        if (!user.isNullOrEmpty() && !pass.isNullOrEmpty() && !uri.contains("@")) {
            val credential = MongoCredential.createCredential(user, "admin", pass.toCharArray())
            builder.credential(credential)
        }

        val settings = builder.build()

        coroutineClient = CoroutineMongoClient.create(settings)
        syncClient = SyncMongoClients.create(settings)

        println("✅ Connected to MongoDB")
    }

    fun getCoroutineClient(): CoroutineMongoClient {
        return coroutineClient ?: throw IllegalStateException("Database not connected. Call connect() first.")
    }

    fun getSyncClient(): SyncMongoClient {
        return syncClient ?: throw IllegalStateException("Database not connected. Call connect() first.")
    }

    fun getCoreDatabase(): CoroutineMongoDatabase {
        val client = getCoroutineClient()
        val dbName = "fiperde_core"
        return dbCache.computeIfAbsent(dbName) { name -> client.getDatabase(name) }
    }

    fun getGlobalVendorDatabase(): CoroutineMongoDatabase {
        val client = getCoroutineClient()
        val dbName = "vendors_global"
        return dbCache.computeIfAbsent(dbName) { name ->
            val database = client.getDatabase(name)
            GlobalScope.launch { createVendorIndexes(database) }
            database
        }
    }

    fun getDatabaseForCompany(companyId: String): CoroutineMongoDatabase {
        val client = getCoroutineClient()
        val dbName = "fi_$companyId"
        return dbCache.computeIfAbsent(dbName) { name ->
            val database = client.getDatabase(name)
            GlobalScope.launch { createIndexesForCompany(database) }
            database
        }
    }

    fun getGridFSBucket(companyId: String, bucketName: String = "images"): GridFSBucket {
        val cacheKey = "${companyId}_$bucketName"
        return gridFSCache.computeIfAbsent(cacheKey) {
            val syncDb = getSyncDatabaseForCompany(companyId)
            GridFSBuckets.create(syncDb, bucketName)
        }
    }

    private fun getSyncDatabaseForCompany(companyId: String): SyncMongoDatabase {
        val client = getSyncClient()
        val dbName = "fi_$companyId"
        return syncDbCache.computeIfAbsent(dbName) { name -> client.getDatabase(name) }
    }

    suspend fun dropCompanyDatabase(companyId: String): Boolean {
        val dbName = "fi_$companyId"
        val client = getCoroutineClient()
        val db = client.getDatabase(dbName)
        db.drop()

        dbCache.remove(dbName)
        syncDbCache.remove(dbName)

        val keysToRemove = gridFSCache.keys().toList().filter { it.startsWith("${companyId}_") }
        for (key in keysToRemove) {
            gridFSCache.remove(key)
        }

        println("🗑️ Dropped database: $dbName")
        return true
    }

    private suspend fun createIndexesForCompany(database: CoroutineMongoDatabase) {
        try {
            database.getCollection<Document>("customers").createIndex(Document("status", 1))
            database.getCollection<Document>("customers").createIndex(Document("createdAt", -1))
            database.getCollection<Document>("customers").createIndex(Document("name", 1).append("surname", 1))

            database.getCollection<Document>("labels").createIndex(Document("name", 1))

            database.getCollection<Document>("customer_images").createIndex(Document("customerId", 1))
            database.getCollection<Document>("customer_images").createIndex(Document("uploadedAt", -1))

            database.getCollection<Document>("sales").createIndex(Document("customerId", 1))
            database.getCollection<Document>("sales").createIndex(Document("status", 1))
            database.getCollection<Document>("sales").createIndex(Document("createdAt", -1))
        } catch (e: Exception) {
            println("⚠️ Index creation warning: ${e.message}")
        }
    }

    private suspend fun createVendorIndexes(database: CoroutineMongoDatabase) {
        try {
            database.getCollection<Document>("vendors").createIndex(Document("name", 1))
            database.getCollection<Document>("products").createIndex(Document("vendorId", 1))
            database.getCollection<Document>("products").createIndex(Document("name", 1))
            database.getCollection<Document>("vendor_attachments").createIndex(Document("vendorId", 1))
            database.getCollection<Document>("vendor_permissions").createIndex(
                Document("companyId", 1).append("vendorId", 1),
                com.mongodb.client.model.IndexOptions().unique(true)
            )
            database.getCollection<Document>("vendor_permissions").createIndex(Document("vendorId", 1))
            database.getCollection<Document>("vendor_price_rates").createIndex(
                Document("vendorId", 1),
                com.mongodb.client.model.IndexOptions().unique(true)
            )
        } catch (e: Exception) {
            println("⚠️ Vendor index creation warning: ${e.message}")
        }
    }

    fun close() {
        coroutineClient?.close()
        syncClient?.close()
        coroutineClient = null
        syncClient = null
        dbCache.clear()
        syncDbCache.clear()
        gridFSCache.clear()
        println("🔌 MongoDB connection closed")
    }
}

package com.ilyasdemirkiran.config

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseToken
import com.ilyasdemirkiran.middleware.AppError
import io.ktor.http.*
import java.io.File
import java.io.FileInputStream

object FirebaseConfig {
    private var firebaseApp: FirebaseApp? = null

    fun initialize(): FirebaseApp? {
        if (firebaseApp != null) {
            return firebaseApp
        }

        val path = Environment.FIREBASE_SERVICE_ACCOUNT_PATH
        val file = File(path)

        val targetFile = when {
            file.exists() -> file
            File(".", "firebase-service-account.json").exists() -> File(".", "firebase-service-account.json")
            File("/app/firebase-service-account.json").exists() -> File("/app/firebase-service-account.json")
            else -> null
        }

        if (targetFile == null) {
            println("⚠️ Firebase service account file not found ($path). Firebase Auth requests will fail until configured.")
            return null
        }

        try {
            FileInputStream(targetFile).use { stream ->
                val options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(stream))
                    .build()

                firebaseApp = FirebaseApp.initializeApp(options)
                println("✅ Firebase Admin SDK initialized using ${targetFile.absolutePath}")
                return firebaseApp
            }
        } catch (e: Exception) {
            println("⚠️ Warning: Failed to initialize Firebase Admin SDK: ${e.message}")
            return null
        }
    }

    suspend fun verifyToken(token: String): FirebaseToken {
        val app = firebaseApp ?: initialize()
        if (app == null) {
            throw AppError(
                HttpStatusCode.InternalServerError,
                "Firebase Admin SDK is not configured. Missing firebase-service-account.json",
                "FIREBASE_NOT_CONFIGURED"
            )
        }

        return try {
            FirebaseAuth.getInstance(app).verifyIdToken(token)
        } catch (e: Exception) {
            println("❌ Token verification failed: ${e.message}")
            throw AppError(
                HttpStatusCode.Unauthorized,
                "Invalid authentication token: ${e.message}",
                "INVALID_TOKEN"
            )
        }
    }
}

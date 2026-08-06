package com.ilyasdemirkiran.config

object Environment {
    val PORT: Int = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val NODE_ENV: String = System.getenv("NODE_ENV") ?: "development"
    val MONGODB_URI: String = System.getenv("MONGODB_URI") ?: "mongodb://localhost:27017"
    val MONGO_ROOT_USERNAME: String? = System.getenv("MONGO_ROOT_USERNAME") ?: "dkilyas"
    val MONGO_ROOT_PASSWORD: String? = System.getenv("MONGO_ROOT_PASSWORD") ?: "Serseri_61!"
    val FIREBASE_SERVICE_ACCOUNT_PATH: String = System.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") ?: "./firebase-service-account.json"
    val DB_NAME: String = System.getenv("DB_NAME") ?: "fiperde"
    val PAYTR_MERCHANT_ID: String = System.getenv("PAYTR_MERCHANT_ID") ?: ""
    val PAYTR_MERCHANT_KEY: String = System.getenv("PAYTR_MERCHANT_KEY") ?: ""
    val PAYTR_MERCHANT_SALT: String = System.getenv("PAYTR_MERCHANT_SALT") ?: ""
    val BASE_URL: String = System.getenv("BASE_URL") ?: "http://localhost:8080"
    val MERCHANT_OK_URL: String = System.getenv("MERCHANT_OK_URL") ?: "http://localhost:8080/success"
    val MERCHANT_FAIL_URL: String = System.getenv("MERCHANT_FAIL_URL") ?: "http://localhost:8080/fail"
    val APP_VERSION: String = System.getenv("APP_VERSION") ?: "1.0.0"

    val isProduction: Boolean = NODE_ENV == "production"

    fun getMongoUri(): String {
        return MONGODB_URI
    }
}

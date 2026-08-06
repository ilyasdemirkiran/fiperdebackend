package com.ilyasdemirkiran

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.config.FirebaseConfig
import com.ilyasdemirkiran.middleware.configureStatusPages
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    install(StatusPages) {
        configureStatusPages()
    }

    // Initialize Firebase Admin SDK
    try {
        FirebaseConfig.initialize()
    } catch (e: Exception) {
        println("⚠️ Firebase initialization warning: ${e.message}")
    }

    // Connect to MongoDB
    Database.connect()

    configureHttp()
    configureSerialization()
    configureRouting()
}
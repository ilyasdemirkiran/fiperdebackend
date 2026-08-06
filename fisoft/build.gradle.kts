plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.kotlin.serialization)
  alias(ktorLibs.plugins.ktor)
}

group = "com.ilyasdemirkiran"
version = "1.0.0-SNAPSHOT"

application {
  mainClass = "io.ktor.server.netty.EngineMain"
}

kotlin {
  jvmToolchain(21)
}
dependencies {
  implementation(ktorLibs.server.compression)
  implementation(ktorLibs.server.config.yaml)
  implementation(ktorLibs.server.contentNegotiation)
  implementation(ktorLibs.server.core)
  implementation(ktorLibs.server.cors)
  implementation(ktorLibs.server.statusPages)
  implementation(ktorLibs.server.callLogging)
  implementation(ktorLibs.server.netty)
  implementation(ktorLibs.serialization.kotlinx.json)
  implementation(ktorLibs.client.logging)
  implementation(ktorLibs.client.cio)

  implementation(libs.logback.classic)
  implementation(libs.jbcrypt)
  implementation(libs.libphonenumber)

  // Kotlin Serialization
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

  // MongoDB Drivers (Coroutine & Sync GridFS)
  implementation("org.mongodb:mongodb-driver-kotlin-coroutine:5.1.0")
  implementation("org.mongodb:mongodb-driver-sync:5.1.0")
  implementation("org.mongodb:bson:5.1.0")

  // Firebase Admin SDK
  implementation("com.google.firebase:firebase-admin:9.3.0")

  testImplementation(kotlin("test"))
  testImplementation(ktorLibs.server.testHost)
}

configurations.all {
  resolutionStrategy {
    // Security patch for transitive dependencies
    force("com.fasterxml.jackson.core:jackson-databind:2.17.2")
  }
}

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
  implementation(ktorLibs.server.netty)

  implementation(ktorLibs.client.cio)

  implementation(libs.logback.classic)

  implementation(platform(libs.supabase.bom))
  implementation(libs.supabase.auth)
  implementation(libs.supabase.postgrest)
  implementation(libs.supabase.storage)

  implementation(libs.flyway.core)
  implementation(libs.flyway.database.postgresql)

  // Kotlin Serialization
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json")

  implementation(libs.exposed.core)
  implementation(libs.exposed.jdbc)
  implementation(libs.exposed.dao)
  implementation(libs.exposed.json)
  implementation(libs.exposed.java.time)

  implementation(libs.libphonenumber)

  runtimeOnly(libs.postgresql)

  testImplementation(kotlin("test"))
  testImplementation(ktorLibs.server.testHost)
}

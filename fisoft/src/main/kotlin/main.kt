package com.ilyasdemirkiran

import com.ilyasdemirkiran.db.DatabaseConnection
import com.ilyasdemirkiran.supabase.SupabaseProvider
import io.ktor.server.application.*

fun main(args: Array<String>) {
  io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
  val config = environment.config

  // Initialize Supabase
  SupabaseProvider.initialize(
    url = config.property("supabase.url").getString(),
    serviceRoleKey = config.property("supabase.serviceRoleKey").getString()
  )

  // Initialize Database Connection (Exposed + PostgreSQL)
  val dbUrl = config.property("db.url").getString()
  val dbUser = config.property("db.user").getString()
  val dbPassword = config.property("db.password").getString()

  DatabaseConnection.connect(dbUrl, dbUser, dbPassword)
}
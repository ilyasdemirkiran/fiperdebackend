package com.ilyasdemirkiran

import com.ilyasdemirkiran.db.DatabaseConnection
import io.ktor.server.application.*

fun main(args: Array<String>) {
  io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
  val config = environment.config

  // Initialize Database Connection (Exposed + PostgreSQL)
  val dbUrl = config.property("db.url").getString()
  val dbUser = config.property("db.user").getString()
  val dbPassword = config.property("db.password").getString()

  DatabaseConnection.connect(dbUrl, dbUser, dbPassword)
}
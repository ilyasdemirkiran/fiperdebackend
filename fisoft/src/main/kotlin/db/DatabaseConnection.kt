package com.ilyasdemirkiran.db

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.core.StdOutSqlLogger
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

object DatabaseConnection {
  fun connect(url: String, user: String, password: String, driver: String = "org.postgresql.Driver") {

    Flyway.configure()
      .dataSource(url, user, password)
      .load()
      .migrate()

    Database.connect(
      url = url,
      driver = driver,
      user = user,
      password = password
    )

    transaction {
      addLogger(StdOutSqlLogger)
      SchemaUtils.create(FIUsersTable, CompaniesTable)
    }

    println("Database connected successfully")
  }
}

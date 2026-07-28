package com.ilyasdemirkiran.db

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.SessionsTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.types.companies.CompanyInvitesTable
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.types.media.ImageTagsTable
import com.ilyasdemirkiran.types.media.PhotoTagsTable
import com.ilyasdemirkiran.types.media.PhotosTable
import com.ilyasdemirkiran.types.products.ProductsTable
import com.ilyasdemirkiran.types.sales.SaleLogsTable
import com.ilyasdemirkiran.types.sales.SalesTable
import com.ilyasdemirkiran.types.vendors.VendorsTable
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
      SchemaUtils.create(
        FIUsersTable,
        CompaniesTable,
        SessionsTable,
        CompanyInvitesTable,
        CustomersTable,
        VendorsTable,
        ProductsTable,
        SalesTable,
        SaleLogsTable,
        ImageTagsTable,
        PhotosTable,
        PhotoTagsTable
      )
    }

    println("Database connected successfully")
  }
}

package com.ilyasdemirkiran.types.products

import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.types.vendors.VendorsTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

object ProductsTable : UuidTable("products") {
  val companyId = reference("company_id", CompaniesTable).index()
  val vendorId = reference("vendor_id", VendorsTable).nullable().index()
  val name = varchar("name", 200).index()
  val code = varchar("code", 100).index()
  val price = integer("price") // Cents / Kuruş (örn: 10.50 TL -> 1050)
  val currency = varchar("currency", 10).default("TRY")
  val description = varchar("description", 1000).nullable()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val updatedAt = timestamp("updated_at").nullable()

  init {
    index(isUnique = false, companyId, code)
    index(isUnique = false, companyId, vendorId)
  }
}

@Serializable
data class Product(
  val id: Uuid,
  val companyId: Uuid,
  val vendorId: Uuid? = null,
  val name: String,
  val code: String,
  val price: Int, // Kuruş cinsinden (örn: 1050 = 10.50 TL)
  val currency: String = "TRY",
  val description: String? = null,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val updatedAt: Instant? = null
)

fun ResultRow.toProduct() = Product(
  id = this[ProductsTable.id].value,
  companyId = this[ProductsTable.companyId].value,
  vendorId = this[ProductsTable.vendorId]?.value,
  name = this[ProductsTable.name],
  code = this[ProductsTable.code],
  price = this[ProductsTable.price],
  currency = this[ProductsTable.currency],
  description = this[ProductsTable.description],
  createdAt = this[ProductsTable.createdAt],
  updatedAt = this[ProductsTable.updatedAt]
)

package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.products.Product
import com.ilyasdemirkiran.types.products.ProductsTable
import com.ilyasdemirkiran.types.products.toProduct
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class ProductRepository {

  fun create(
    companyId: Uuid,
    name: String,
    code: String,
    price: Int,
    currency: String = "TRY",
    vendorId: Uuid? = null,
    description: String? = null
  ): Product = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    ProductsTable.insert {
      it[ProductsTable.id] = id
      it[ProductsTable.companyId] = companyId
      it[ProductsTable.vendorId] = vendorId
      it[ProductsTable.name] = name
      it[ProductsTable.code] = code
      it[ProductsTable.price] = price
      it[ProductsTable.currency] = currency
      it[ProductsTable.description] = description
      it[ProductsTable.createdAt] = createdAt
    }

    Product(
      id = id,
      companyId = companyId,
      vendorId = vendorId,
      name = name,
      code = code,
      price = price,
      currency = currency,
      description = description,
      createdAt = createdAt
    )
  }

  fun getById(id: Uuid, companyId: Uuid): Product? = transaction {
    ProductsTable.selectAll()
      .where { (ProductsTable.id eq id) and (ProductsTable.companyId eq companyId) }
      .map { it.toProduct() }
      .firstOrNull()
  }

  fun getByCompanyId(companyId: Uuid): List<Product> = transaction {
    ProductsTable.selectAll()
      .where { ProductsTable.companyId eq companyId }
      .map { it.toProduct() }
  }

  fun getByVendorId(vendorId: Uuid, companyId: Uuid): List<Product> = transaction {
    ProductsTable.selectAll()
      .where { (ProductsTable.vendorId eq vendorId) and (ProductsTable.companyId eq companyId) }
      .map { it.toProduct() }
  }

  fun update(
    id: Uuid,
    companyId: Uuid,
    name: String? = null,
    code: String? = null,
    price: Int? = null,
    currency: String? = null,
    vendorId: Uuid? = null,
    description: String? = null
  ): Product? = transaction {
    val updatedAt = Instant.now()
    ProductsTable.update({ (ProductsTable.id eq id) and (ProductsTable.companyId eq companyId) }) { update ->
      name?.let { update[ProductsTable.name] = it }
      code?.let { update[ProductsTable.code] = it }
      price?.let { update[ProductsTable.price] = it }
      currency?.let { update[ProductsTable.currency] = it }
      vendorId?.let { update[ProductsTable.vendorId] = it }
      description?.let { update[ProductsTable.description] = it }
      update[ProductsTable.updatedAt] = updatedAt
    }

    getById(id, companyId)
  }

  fun delete(id: Uuid, companyId: Uuid): Boolean = transaction {
    ProductsTable.deleteWhere { (ProductsTable.id eq id) and (ProductsTable.companyId eq companyId) } > 0
  }
}

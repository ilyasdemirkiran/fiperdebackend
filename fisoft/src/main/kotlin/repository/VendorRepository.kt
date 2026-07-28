package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.vendors.Vendor
import com.ilyasdemirkiran.types.vendors.VendorsTable
import com.ilyasdemirkiran.types.vendors.toVendor
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class VendorRepository {

  fun create(
    companyId: Uuid,
    name: String,
    phone: String? = null,
    city: String? = null,
    district: String? = null,
    address: String? = null
  ): Vendor = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    VendorsTable.insert {
      it[VendorsTable.id] = id
      it[VendorsTable.companyId] = companyId
      it[VendorsTable.name] = name
      it[VendorsTable.phone] = phone
      it[VendorsTable.city] = city
      it[VendorsTable.district] = district
      it[VendorsTable.address] = address
      it[VendorsTable.createdAt] = createdAt
    }

    Vendor(
      id = id,
      companyId = companyId,
      name = name,
      phone = phone,
      city = city,
      district = district,
      address = address,
      createdAt = createdAt
    )
  }

  fun getById(id: Uuid, companyId: Uuid): Vendor? = transaction {
    VendorsTable.selectAll()
      .where { (VendorsTable.id eq id) and (VendorsTable.companyId eq companyId) }
      .map { it.toVendor() }
      .firstOrNull()
  }

  fun getByCompanyId(companyId: Uuid): List<Vendor> = transaction {
    VendorsTable.selectAll()
      .where { VendorsTable.companyId eq companyId }
      .map { it.toVendor() }
  }

  fun update(
    id: Uuid,
    companyId: Uuid,
    name: String? = null,
    phone: String? = null,
    city: String? = null,
    district: String? = null,
    address: String? = null
  ): Vendor? = transaction {
    VendorsTable.update({ (VendorsTable.id eq id) and (VendorsTable.companyId eq companyId) }) { update ->
      name?.let { update[VendorsTable.name] = it }
      phone?.let { update[VendorsTable.phone] = it }
      city?.let { update[VendorsTable.city] = it }
      district?.let { update[VendorsTable.district] = it }
      address?.let { update[VendorsTable.address] = it }
    }

    getById(id, companyId)
  }

  fun delete(id: Uuid, companyId: Uuid): Boolean = transaction {
    VendorsTable.deleteWhere { (VendorsTable.id eq id) and (VendorsTable.companyId eq companyId) } > 0
  }
}

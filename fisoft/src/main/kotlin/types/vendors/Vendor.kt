package com.ilyasdemirkiran.types.vendors

import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

object VendorsTable : UuidTable("vendors") {
  val companyId = reference("company_id", CompaniesTable).index()
  val name = varchar("name", 200).index()
  val phone = varchar("phone", 20).nullable()
  val city = varchar("city", 100).nullable()
  val district = varchar("district", 100).nullable()
  val address = varchar("address", 1000).nullable()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  init {
    index(isUnique = false, companyId, name)
  }
}

@Serializable
data class Vendor(
  val id: Uuid,
  val companyId: Uuid,
  val name: String,
  val phone: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

fun ResultRow.toVendor() = Vendor(
  id = this[VendorsTable.id].value,
  companyId = this[VendorsTable.companyId].value,
  name = this[VendorsTable.name],
  phone = this[VendorsTable.phone],
  city = this[VendorsTable.city],
  district = this[VendorsTable.district],
  address = this[VendorsTable.address],
  createdAt = this[VendorsTable.createdAt]
)

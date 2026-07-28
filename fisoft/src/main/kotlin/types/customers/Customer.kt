package com.ilyasdemirkiran.types.customers

import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class CustomerStatus {
  Active, Inactive
}

object CustomersTable : UuidTable("customers") {
  val companyId = reference("company_id", CompaniesTable).index()
  val name = varchar("name", 200).index()
  val surname = varchar("surname", 200).index()
  val phoneNumber = varchar("phone_number", 20).nullable()
  val city = varchar("city", 100).nullable()
  val district = varchar("district", 100).nullable()
  val address = varchar("address", 500).nullable()
  val status = enumerationByName<CustomerStatus>("status", 20).default(CustomerStatus.Active).index()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  init {
    index(isUnique = false, companyId, name, surname)
  }
}

@Serializable
data class Customer(
  val id: Uuid,
  val companyId: Uuid,
  val name: String,
  val surname: String,
  val phoneNumber: String? = null,
  val city: String? = null,
  val district: String? = null,
  val address: String? = null,
  val status: CustomerStatus = CustomerStatus.Active,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

fun ResultRow.toCustomer() = Customer(
  id = this[CustomersTable.id].value,
  companyId = this[CustomersTable.companyId].value,
  name = this[CustomersTable.name],
  surname = this[CustomersTable.surname],
  phoneNumber = this[CustomersTable.phoneNumber],
  city = this[CustomersTable.city],
  district = this[CustomersTable.district],
  address = this[CustomersTable.address],
  status = this[CustomersTable.status],
  createdAt = this[CustomersTable.createdAt]
)
package com.ilyasdemirkiran.types.customers

import com.ilyasdemirkiran.types.PhoneNumber
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.dao.id.java.UUIDTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class CustomerStatus {
  Active, Inactive
}

object CustomersTable : UUIDTable("customers") {
  val phoneNumber = varchar("phone_number", 20)
  val name = varchar("name", 200)
  val surname = varchar("surname", 200)
  val companyId = uuid("company_id").nullable().index()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  val status = enumerationByName<CustomerStatus>("status", 20).index()
}

@Serializable
data class Customer(
  val id: Uuid,
  val phoneNumber: PhoneNumber,
  val name: String,
  val surname: String,
  val companyId: Uuid?,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  val status: CustomerStatus
)
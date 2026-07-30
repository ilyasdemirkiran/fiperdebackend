package com.ilyasdemirkiran.types.customers

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

object CustomerNotesTable : UuidTable("customer_notes") {
  val customerId = reference("customer_id", CustomersTable).index()
  val companyId = reference("company_id", CompaniesTable).index()
  val userId = reference("user_id", FIUsersTable).index()
  val note = text("note")
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val updatedAt = timestamp("updated_at").clientDefault { Instant.now() }
}

@Serializable
data class CustomerNote(
  val id: Uuid,
  val customerId: Uuid,
  val companyId: Uuid,
  val userId: Uuid,
  val note: String,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val updatedAt: Instant,
  val userName: String? = null
)

fun ResultRow.toCustomerNote(userName: String? = null) = CustomerNote(
  id = this[CustomerNotesTable.id].value,
  customerId = this[CustomerNotesTable.customerId].value,
  companyId = this[CustomerNotesTable.companyId].value,
  userId = this[CustomerNotesTable.userId].value,
  note = this[CustomerNotesTable.note],
  createdAt = this[CustomerNotesTable.createdAt],
  updatedAt = this[CustomerNotesTable.updatedAt],
  userName = userName
)

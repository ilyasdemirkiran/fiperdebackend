package com.ilyasdemirkiran.types

import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

object SessionsTable : UuidTable("sessions") {
  val userId = uuid("user_id").references(FIUsersTable.id)
  val phoneNumber = varchar("phone_number", 20)
  val companyId = uuid("company_id").nullable()
  val role = enumerationByName<UserRole>("role", 10)
  val token = varchar("token", 255).index()
  val createdAt = timestamp("created_at")
  val expiresAt = timestamp("expires_at")
}

@Serializable
data class Session(
  val id: Uuid,
  val userId: Uuid,
  val phoneNumber: PhoneNumber,
  val companyId: Uuid?,
  val role: UserRole,
  val token: String,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  @Serializable(with = InstantSerializer::class) val expiresAt: Instant,
)

fun ResultRow.toSession() = Session(
  id = this[SessionsTable.id].value,
  userId = this[SessionsTable.userId],
  phoneNumber = PhoneNumber(this[SessionsTable.phoneNumber]),
  companyId = this[SessionsTable.companyId],
  role = this[SessionsTable.role],
  token = this[SessionsTable.token],
  createdAt = this[SessionsTable.createdAt],
  expiresAt = this[SessionsTable.expiresAt]
)

package com.ilyasdemirkiran.types

import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class UserRole {
  SUDO, ADMIN, USER;

  val isAdmin: Boolean
    get() = this == SUDO || this == ADMIN
}

object FIUsersTable : UuidTable("fiusers") {
  val phoneNumber = varchar("phone_number", 20).uniqueIndex()
  val passwordHash = varchar("password_hash", 255)
  val name = varchar("name", 100)
  val surname = varchar("surname", 100)
  val companyId = uuid("company_id").nullable().index()
  val role = enumerationByName<UserRole>("role", 10)
  val createdAt = timestamp("created_at")
}

@Serializable
data class FIUser(
  val id: Uuid,
  val phoneNumber: PhoneNumber,
  val name: String,
  val surname: String,
  val companyId: Uuid?,
  val role: UserRole,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
)

fun ResultRow.toFIUser() = FIUser(
  id = this[FIUsersTable.id].value,
  phoneNumber = PhoneNumber(this[FIUsersTable.phoneNumber]),
  name = this[FIUsersTable.name],
  surname = this[FIUsersTable.surname],
  companyId = this[FIUsersTable.companyId],
  role = this[FIUsersTable.role],
  createdAt = this[FIUsersTable.createdAt]
)
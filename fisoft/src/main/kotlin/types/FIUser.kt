package com.ilyasdemirkiran.types

import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.java.UUIDTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid
import kotlin.uuid.toKotlinUuid

@Serializable
enum class UserRole {
  SUDO, ADMIN, USER;

  val isAdmin: Boolean
    get() = this == SUDO || this == ADMIN
}

object FIUsers : UUIDTable("fiusers") {
  val phoneNumber = varchar("phone_number", 20).uniqueIndex()
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
  id = this[FIUsers.id].value.toKotlinUuid(),
  phoneNumber = PhoneNumber(this[FIUsers.phoneNumber]),
  name = this[FIUsers.name],
  surname = this[FIUsers.surname],
  companyId = this[FIUsers.companyId],
  role = this[FIUsers.role],
  createdAt = this[FIUsers.createdAt]
)
package com.ilyasdemirkiran.types.companies

import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

object CompaniesTable : UuidTable("companies") {
  val name = varchar("name", 200).uniqueIndex()
  val address = varchar("address", 500)
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
  val creatorId = uuid("creator_id").nullable()
  val logoOriginalFileId = uuid("logo_original_file_id").nullable()
  val logoMiniFileId = uuid("logo_mini_file_id").nullable()
}

@Serializable
data class Company(
  val id: Uuid,
  val name: String,
  val address: String,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  val creatorId: Uuid?,
  val logoOriginalFileId: Uuid?,
  val logoMiniFileId: Uuid?
)

fun ResultRow.toCompany() = Company(
  id = this[CompaniesTable.id].value,
  name = this[CompaniesTable.name],
  address = this[CompaniesTable.address],
  createdAt = this[CompaniesTable.createdAt],
  creatorId = this[CompaniesTable.creatorId],
  logoOriginalFileId = this[CompaniesTable.logoOriginalFileId],
  logoMiniFileId = this[CompaniesTable.logoMiniFileId]
)
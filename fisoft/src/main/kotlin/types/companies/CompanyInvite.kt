package com.ilyasdemirkiran.types.companies

import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

@Serializable
enum class InviteStatus {
  PENDING, ACCEPTED, REJECTED
}

object CompanyInvitesTable : UuidTable("company_invites") {
  val companyId = uuid("company_id").index()
  val inviterUserId = uuid("inviter_user_id")
  val invitedUserId = uuid("invited_user_id").nullable()
  val invitedPhoneNumber = varchar("invited_phone_number", 20)
  val status = enumerationByName<InviteStatus>("status", 20).clientDefault { InviteStatus.PENDING }
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }
}

@Serializable
data class CompanyInvite(
  val id: Uuid,
  val companyId: Uuid,
  val inviterUserId: Uuid,
  val invitedUserId: Uuid?,
  val invitedPhoneNumber: String,
  val status: InviteStatus,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant,
  val companyName: String? = null
)

fun ResultRow.toCompanyInvite(companyName: String? = null) = CompanyInvite(
  id = this[CompanyInvitesTable.id].value,
  companyId = this[CompanyInvitesTable.companyId],
  inviterUserId = this[CompanyInvitesTable.inviterUserId],
  invitedUserId = this[CompanyInvitesTable.invitedUserId],
  invitedPhoneNumber = this[CompanyInvitesTable.invitedPhoneNumber],
  status = this[CompanyInvitesTable.status],
  createdAt = this[CompanyInvitesTable.createdAt],
  companyName = companyName
)

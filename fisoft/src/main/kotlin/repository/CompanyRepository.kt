package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.PhoneNumbers
import com.ilyasdemirkiran.types.companies.*
import com.ilyasdemirkiran.utils.toUuid
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class CompanyRepository {

  // --- Company CRUD ---

  fun getAll(): List<Company> = transaction {
    CompaniesTable.selectAll()
      .map { it.toCompany() }
  }

  fun getById(id: Uuid): Company? = transaction {
    CompaniesTable.selectAll().where { CompaniesTable.id eq id }
      .map { it.toCompany() }
      .firstOrNull()
  }

  fun getByIds(ids: List<Uuid>): List<Company> = transaction {
    if (ids.isEmpty()) return@transaction emptyList()
    CompaniesTable.selectAll().where { CompaniesTable.id inList ids }
      .map { it.toCompany() }
  }

  fun create(name: String, address: String = "", creatorId: Uuid? = null): Company = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    CompaniesTable.insert {
      it[CompaniesTable.id] = id
      it[CompaniesTable.name] = name
      it[CompaniesTable.address] = address
      it[CompaniesTable.createdAt] = createdAt
      it[CompaniesTable.creatorId] = creatorId
    }

    Company(
      id = id,
      name = name,
      address = address,
      createdAt = createdAt,
      creatorId = creatorId,
      logoOriginalFileId = null,
      logoMiniFileId = null
    )
  }

  fun update(id: Uuid, name: String? = null, address: String? = null): Company? = transaction {
    CompaniesTable.update({ CompaniesTable.id eq id }) { update ->
      name?.let { update[CompaniesTable.name] = it }
      address?.let { update[CompaniesTable.address] = it }
    }

    getById(id)
  }

  fun delete(id: Uuid): Boolean = transaction {
    // Delete associated company invites first
    CompanyInvitesTable.deleteWhere { CompanyInvitesTable.companyId eq id }
    val deleted = CompaniesTable.deleteWhere { CompaniesTable.id eq id }
    deleted > 0
  }

  fun updateLogo(id: Uuid, logoOriginalFileId: Uuid?, logoMiniFileId: Uuid?): Company? = transaction {
    CompaniesTable.update({ CompaniesTable.id eq id }) { update ->
      update[CompaniesTable.logoOriginalFileId] = logoOriginalFileId
      update[CompaniesTable.logoMiniFileId] = logoMiniFileId
    }

    getById(id)
  }

  // --- Company Invites ---

  fun createInvite(
    companyId: Uuid,
    inviterUserId: Uuid,
    invitedUserId: Uuid?,
    invitedPhoneNumber: String
  ): CompanyInvite = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    CompanyInvitesTable.insert {
      it[CompanyInvitesTable.id] = id
      it[CompanyInvitesTable.companyId] = companyId
      it[CompanyInvitesTable.inviterUserId] = inviterUserId
      it[CompanyInvitesTable.invitedUserId] = invitedUserId
      it[CompanyInvitesTable.invitedPhoneNumber] = invitedPhoneNumber
      it[CompanyInvitesTable.status] = InviteStatus.PENDING
      it[CompanyInvitesTable.createdAt] = createdAt
    }

    CompanyInvite(
      id = id,
      companyId = companyId,
      inviterUserId = inviterUserId,
      invitedUserId = invitedUserId,
      invitedPhoneNumber = invitedPhoneNumber,
      status = InviteStatus.PENDING,
      createdAt = createdAt
    )
  }

  fun getInviteById(inviteId: Uuid): CompanyInvite? = transaction {
    CompanyInvitesTable.selectAll().where { CompanyInvitesTable.id eq inviteId }
      .map { it.toCompanyInvite() }
      .firstOrNull()
  }

  fun findPendingInviteByPhoneAndCompany(phone: String, companyId: Uuid): CompanyInvite? = transaction {
    val targetDigits = PhoneNumbers.normalizeToDigits(phone)
    CompanyInvitesTable.selectAll()
      .where { (CompanyInvitesTable.companyId eq companyId) and (CompanyInvitesTable.status eq InviteStatus.PENDING) }
      .map { it.toCompanyInvite() }
      .firstOrNull { PhoneNumbers.normalizeToDigits(it.invitedPhoneNumber) == targetDigits }
  }

  fun findInvitesByCompanyId(companyId: Uuid): List<CompanyInvite> = transaction {
    CompanyInvitesTable.selectAll()
      .where { CompanyInvitesTable.companyId eq companyId }
      .map { it.toCompanyInvite() }
  }

  fun findPendingInvitesByPhone(phone: String): List<CompanyInvite> = transaction {
    val targetDigits = PhoneNumbers.normalizeToDigits(phone)
    val allPendingInvites = CompanyInvitesTable.selectAll()
      .where { CompanyInvitesTable.status eq InviteStatus.PENDING }
      .map { it.toCompanyInvite() }

    val invites = allPendingInvites.filter { invite ->
      PhoneNumbers.normalizeToDigits(invite.invitedPhoneNumber) == targetDigits
    }

    if (invites.isEmpty()) return@transaction emptyList()

    val companyIds = invites.map { it.companyId }.distinct()
    val companyNameMap = CompaniesTable.selectAll()
      .where { CompaniesTable.id inList companyIds }
      .associate { it[CompaniesTable.id].value.toString() to it[CompaniesTable.name] }

    invites.map { invite ->
      invite.copy(companyName = companyNameMap[invite.companyId.toString()])
    }
  }

  fun updateInviteStatus(inviteId: Uuid, status: InviteStatus): Boolean = transaction {
    CompanyInvitesTable.update({ CompanyInvitesTable.id eq inviteId }) {
      it[CompanyInvitesTable.status] = status
    } > 0
  }

  fun deleteInvite(inviteId: Uuid): Boolean = transaction {
    CompanyInvitesTable.deleteWhere { CompanyInvitesTable.id eq inviteId } > 0
  }
}
package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.config.Database
import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CompanyInviteRepository
import com.ilyasdemirkiran.repository.CompanyRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.companies.Company
import com.ilyasdemirkiran.types.companies.CompanyInvite
import com.ilyasdemirkiran.utils.Logger
import io.ktor.http.*
import java.time.Instant

class CompanyService(
    private val companyRepo: CompanyRepository = CompanyRepository(),
    private val inviteRepo: CompanyInviteRepository = CompanyInviteRepository(),
    private val userRepo: UserRepository = UserRepository()
) {
    suspend fun createCompany(userId: String, name: String): Company {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != null) {
            throw AppError(HttpStatusCode.BadRequest, "User already has a company")
        }

        val company = Company(
            name = name,
            creatorUserId = userId,
            userIds = listOf(userId),
            registrationAgreement = true,
            createdAt = Instant.now().toString()
        )

        val inserted = companyRepo.create(company)
        val companyIdStr = inserted._id!!
        userRepo.update(userId, companyId = companyIdStr, role = UserRole.admin)

        Logger.info("Company created: $companyIdStr by user $userId")
        return inserted
    }

    suspend fun inviteUser(inviterId: String, companyId: String, phone: String): CompanyInvite {
        val inviter = userRepo.findById(inviterId) ?: throw AppError(HttpStatusCode.NotFound, "Inviter not found")
        if (inviter.companyId != companyId) {
            throw AppError(HttpStatusCode.Forbidden, "Not authorized to invite for this company")
        }
        if (inviter.role == UserRole.user) {
            throw AppError(HttpStatusCode.Forbidden, "User role cannot invite")
        }

        val invitedUser = userRepo.findByPhoneNumber(phone)
        if (invitedUser != null && invitedUser.companyId != null) {
            throw AppError(HttpStatusCode.BadRequest, "User is already in a company")
        }

        val code = (100000..999999).random().toString()
        val invite = CompanyInvite(
            companyId = companyId,
            inviterUserId = inviterId,
            creatorUserId = inviterId,
            invitedUserId = invitedUser?._id,
            invitedPhoneNumber = phone,
            code = code,
            status = "pending",
            createdAt = Instant.now().toString()
        )

        return inviteRepo.create(invite)
    }

    suspend fun respondToInvite(userId: String, inviteId: String, accept: Boolean) {
        val invite = inviteRepo.findById(inviteId) ?: throw AppError(HttpStatusCode.NotFound, "Invite not found")
        if (invite.status != "pending") {
            throw AppError(HttpStatusCode.BadRequest, "Invite no longer pending")
        }

        if (invite.invitedUserId != null && invite.invitedUserId.isNotEmpty() && invite.invitedUserId != userId) {
            throw AppError(HttpStatusCode.Forbidden, "Invite does not belong to you")
        }

        if (!accept) {
            inviteRepo.updateStatus(inviteId, "rejected")
            return
        }

        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != null) {
            throw AppError(HttpStatusCode.BadRequest, "You are already in a company")
        }

        inviteRepo.updateStatus(inviteId, "accepted")
        val inviteCompanyId = invite.companyId ?: throw AppError(HttpStatusCode.BadRequest, "Invite has no company")
        companyRepo.addUser(inviteCompanyId, userId)
        userRepo.update(userId, companyId = inviteCompanyId, role = UserRole.user)
    }

    suspend fun getCompanyInvites(userId: String, companyId: String): List<CompanyInvite> {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != companyId) throw AppError(HttpStatusCode.Forbidden, "Not authorized")
        return inviteRepo.findByCompanyId(companyId)
    }

    suspend fun getMyInvites(userId: String): List<CompanyInvite> {
        val user = userRepo.findById(userId)
        return inviteRepo.findByInvitedUserIdOrPhone(userId, user?.phoneNumber)
    }

    suspend fun deleteInvite(userId: String, inviteId: String) {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        val invite = inviteRepo.findById(inviteId) ?: throw AppError(HttpStatusCode.NotFound, "Invite not found")
        if (user.companyId != invite.companyId) throw AppError(HttpStatusCode.Forbidden, "Not authorized")
        inviteRepo.delete(inviteId)
    }

    suspend fun leaveCompany(userId: String) {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        val companyId = user.companyId ?: throw AppError(HttpStatusCode.BadRequest, "Not in a company")
        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")

        if (company.creatorUserId == userId) {
            throw AppError(HttpStatusCode.BadRequest, "Company owner cannot leave. Delete company instead.")
        }

        companyRepo.removeUser(companyId, userId)
        userRepo.update(userId, companyId = null, role = UserRole.user)
    }

    suspend fun promoteUser(adminUserId: String, companyId: String, targetUserId: String) {
        val admin = userRepo.findById(adminUserId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (admin.companyId != companyId || !admin.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Not authorized")
        userRepo.update(targetUserId, role = UserRole.admin)
    }

    suspend fun demoteUser(adminUserId: String, companyId: String, targetUserId: String) {
        val admin = userRepo.findById(adminUserId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (admin.companyId != companyId || !admin.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Not authorized")

        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")
        if (company.creatorUserId == targetUserId) {
            throw AppError(HttpStatusCode.BadRequest, "Cannot demote company owner")
        }

        userRepo.update(targetUserId, role = UserRole.user)
    }

    suspend fun removeUserFromCompany(adminUserId: String, companyId: String, targetUserId: String) {
        val admin = userRepo.findById(adminUserId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (admin.companyId != companyId || !admin.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Not authorized")

        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")
        if (company.creatorUserId == targetUserId) {
            throw AppError(HttpStatusCode.BadRequest, "Cannot remove company owner")
        }

        companyRepo.removeUser(companyId, targetUserId)
        userRepo.update(targetUserId, companyId = null, role = UserRole.user)
    }

    suspend fun getMyCompany(userId: String): Company? {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        val companyId = user.companyId ?: return null
        return companyRepo.findById(companyId)
    }

    suspend fun getCompanyUsers(userId: String, companyId: String): List<FIUser> {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != companyId) throw AppError(HttpStatusCode.Forbidden, "Not authorized")
        return userRepo.findByCompanyId(companyId)
    }

    suspend fun updateCompanyName(userId: String, name: String): Company {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        val companyId = user.companyId ?: throw AppError(HttpStatusCode.BadRequest, "User is not in a company")
        if (!user.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Only admins can update company name")

        return companyRepo.update(companyId, name = name)
            ?: throw AppError(HttpStatusCode.InternalServerError, "Failed to update company name")
    }

    suspend fun uploadCompanyLogo(
        userId: String,
        companyId: String,
        originalData: ByteArray?,
        originalMime: String?,
        miniData: ByteArray?,
        miniMime: String?
    ): Company {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != companyId || !user.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Not authorized")

        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")

        var origFileId = company.logoOriginalFileId
        var miniFileId = company.logoMiniFileId

        if (originalData != null && originalMime != null) {
            if (origFileId != null) companyRepo.deleteLogoFromGridFS(companyId, origFileId)
            origFileId = companyRepo.uploadLogoToGridFS(companyId, "logo_original", originalData, originalMime)
        }

        if (miniData != null && miniMime != null) {
            if (miniFileId != null) companyRepo.deleteLogoFromGridFS(companyId, miniFileId)
            miniFileId = companyRepo.uploadLogoToGridFS(companyId, "logo_mini", miniData, miniMime)
        }

        return companyRepo.update(companyId, logoOriginalFileId = origFileId, logoMiniFileId = miniFileId)
            ?: throw AppError(HttpStatusCode.InternalServerError, "Failed to update logo")
    }

    fun getCompanyLogo(companyId: String, type: String): Pair<ByteArray, String> {
        val company = kotlinx.coroutines.runBlocking { companyRepo.findById(companyId) }
            ?: throw AppError(HttpStatusCode.NotFound, "Company not found")

        val fileId = when (type) {
            "mini" -> company.logoMiniFileId ?: company.logoOriginalFileId
            "original" -> company.logoOriginalFileId
            else -> null
        } ?: throw AppError(HttpStatusCode.NotFound, "Logo not found")

        return companyRepo.downloadLogoFromGridFS(companyId, fileId)
    }

    suspend fun deleteCompanyLogo(userId: String, companyId: String): Company {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        if (user.companyId != companyId || !user.isAdmin()) throw AppError(HttpStatusCode.Forbidden, "Not authorized")

        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")

        if (company.logoOriginalFileId != null) {
            companyRepo.deleteLogoFromGridFS(companyId, company.logoOriginalFileId)
        }
        if (company.logoMiniFileId != null) {
            companyRepo.deleteLogoFromGridFS(companyId, company.logoMiniFileId)
        }

        return companyRepo.update(companyId, logoOriginalFileId = "", logoMiniFileId = "")
            ?: company
    }

    suspend fun deleteCompany(userId: String) {
        val user = userRepo.findById(userId) ?: throw AppError(HttpStatusCode.NotFound, "User not found")
        val companyId = user.companyId ?: throw AppError(HttpStatusCode.BadRequest, "User is not in a company")

        val company = companyRepo.findById(companyId) ?: throw AppError(HttpStatusCode.NotFound, "Company not found")
        if (company.creatorUserId != userId) {
            throw AppError(HttpStatusCode.Forbidden, "Only the company owner can delete the company")
        }

        val users = userRepo.findByCompanyId(companyId)
        for (u in users) {
            userRepo.update(u._id, companyId = null, role = UserRole.user)
        }

        Database.dropCompanyDatabase(companyId)
        companyRepo.delete(companyId)
    }
}

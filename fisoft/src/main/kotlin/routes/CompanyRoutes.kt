package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.CompanyRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.PhoneNumbers
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.companies.Company
import com.ilyasdemirkiran.types.companies.CompanyInvite
import com.ilyasdemirkiran.types.companies.InviteStatus
import com.ilyasdemirkiran.types.request.*
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.companyRoutes(companyRepository: CompanyRepository, userRepository: UserRepository) {

  // POST /companies - Create company
  post("/companies") {
    call.authenticate<Company>(requireCompany = false, userRepository = userRepository) { auth ->
      val user = auth.user

      if (user.companyId != null) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Company>(false, "User already has a company"))
      }

      val request = call.receive<CreateCompanyRequest>()
      val company = companyRepository.create(name = request.name, address = request.address, creatorId = user.id)

      // Creator becomes admin of the new company
      userRepository.update(userId = user.id, companyId = company.id, role = UserRole.ADMIN)

      call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Company created", data = company))
    }
  }

  // POST /companies/invite - Invite user to company
  post("/companies/invite") {
    call.authenticate<CompanyInvite>(requireCompany = true, userRepository = userRepository) { auth ->
      val inviter = auth.user
      val companyId = inviter.companyId!!

      if (inviter.role == UserRole.USER) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<CompanyInvite>(false, "User role cannot invite"))
      }

      val request = call.receive<InviteUserRequest>()

      val normalizedPhone = try {
        PhoneNumbers.parse(request.phone).value
      } catch (e: Exception) {
        request.phone.filter { it.isDigit() }.let { if (it.length >= 10) "+90${it.takeLast(10)}" else request.phone }
      }

      // Check if already invited
      val existingInvite = companyRepository.findPendingInviteByPhoneAndCompany(normalizedPhone, companyId)
      if (existingInvite != null) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "User already invited"))
      }

      val invitedUser = userRepository.getByPhoneNumber(normalizedPhone)
      if (invitedUser != null && invitedUser.companyId != null) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "User is already in a company"))
      }

      val invite = companyRepository.createInvite(
        companyId = companyId,
        inviterUserId = inviter.id,
        invitedUserId = invitedUser?.id,
        invitedPhoneNumber = normalizedPhone
      )

      call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Invite created", data = invite))
    }
  }

  // POST /companies/invites/{id}/respond - Respond to invite
  post("/companies/invites/{id}/respond") {
    call.authenticate<Map<String, Boolean>>(requireCompany = false, userRepository = userRepository) { auth ->
      val user = auth.user
      val inviteIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Invite ID is required")
      val inviteId = inviteIdStr.toUuid()

      val invite = companyRepository.getInviteById(inviteId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Invite not found"))

      if (invite.status != InviteStatus.PENDING) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Invite no longer pending"))
      }

      val request = call.receive<RespondInviteRequest>()
      if (!request.accept) {
        companyRepository.updateInviteStatus(inviteId, InviteStatus.REJECTED)
        return@authenticate call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Invite rejected"))
      }

      if (user.companyId != null) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "You are already in a company"))
      }

      companyRepository.updateInviteStatus(inviteId, InviteStatus.ACCEPTED)
      userRepository.update(userId = user.id, companyId = invite.companyId, role = UserRole.USER)

      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Invite accepted and user added to company"))
    }
  }

  // GET /companies/invites - Get company invites
  get("/companies/invites") {
    call.authenticate<List<CompanyInvite>>(requireCompany = true, userRepository = userRepository) { auth ->
      val invites = companyRepository.findInvitesByCompanyId(auth.user.companyId!!)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = invites))
    }
  }

  // GET /companies/my-invites - Get my pending invites
  get("/companies/my-invites") {
    call.authenticate<List<CompanyInvite>>(requireCompany = false, userRepository = userRepository) { auth ->
      val invites = companyRepository.findPendingInvitesByPhone(auth.user.phoneNumber.value)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = invites))
    }
  }

  // GET /companies/my-company - Get my company details
  get("/companies/my-company") {
    call.authenticate<Company?>(requireCompany = false, userRepository = userRepository) { auth ->
      val company = auth.user.companyId?.let { companyRepository.getById(it) }
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = company, message = "Company details fetched successfully"))
    }
  }

  // PUT /companies/name - Update company name
  put("/companies/name") {
    call.authenticate<Company>(requireCompany = true, userRepository = userRepository) { auth ->
      val user = auth.user
      val companyId = user.companyId!!

      if (!user.role.isAdmin) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Company>(false, "Only admins can update company name"))
      }

      val request = call.receive<UpdateCompanyNameRequest>()
      val updated = companyRepository.update(id = companyId, name = request.name)

      call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Company name updated", data = updated))
    }
  }

  // DELETE /companies/me - Delete company (owner only)
  delete("/companies/me") {
    call.authenticate<Map<String, Any>>(requireCompany = true, userRepository = userRepository) { auth ->
      val user = auth.user
      val companyId = user.companyId!!

      val company = companyRepository.getById(companyId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Any>>(false, "Company not found"))

      if (company.creatorId != user.id) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Any>>(false, "Only the company owner can delete the company"))
      }

      // Reset all users in the company
      val users = userRepository.getByCompanyId(companyId)
      users.forEach { u ->
        userRepository.clearCompanyId(u.id)
      }

      companyRepository.delete(companyId)

      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true, "message" to "Company deleted successfully")))
    }
  }

  // POST /companies/leave - Leave current company
  post("/companies/leave") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val user = auth.user
      val companyId = user.companyId!!

      val company = companyRepository.getById(companyId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == user.id) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Company owner cannot leave the company"))
      }

      userRepository.clearCompanyId(user.id)

      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true)))
    }
  }

  // POST /companies/invites/{inviteId}/cancel - Cancel an invite
  post("/companies/invites/{inviteId}/cancel") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val requester = auth.user
      val inviteIdStr = call.parameters["inviteId"] ?: throw IllegalArgumentException("Invite ID is required")
      val inviteId = inviteIdStr.toUuid()

      if (requester.role == UserRole.USER) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "User role cannot cancel invites"))
      }

      val invite = companyRepository.getInviteById(inviteId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Invite not found"))

      if (invite.companyId != requester.companyId) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Invite belongs to another company"))
      }

      if (invite.status != InviteStatus.PENDING) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Only pending invites can be cancelled"))
      }

      companyRepository.updateInviteStatus(inviteId, InviteStatus.CANCELLED)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Invite cancelled"))
    }
  }

  // DELETE /companies/invites/{inviteId} - Delete an invite
  delete("/companies/invites/{inviteId}") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val requester = auth.user
      val inviteIdStr = call.parameters["inviteId"] ?: throw IllegalArgumentException("Invite ID is required")
      val inviteId = inviteIdStr.toUuid()

      if (requester.role == UserRole.USER) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to delete invites"))
      }

      val invite = companyRepository.getInviteById(inviteId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Invite not found"))

      if (invite.companyId != requester.companyId) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Invite belongs to another company"))
      }

      companyRepository.deleteInvite(inviteId)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Invite deleted"))
    }
  }

  // GET /companies/{id}/users - Get users of a company
  get("/companies/{id}/users") {
    call.authenticate<List<FIUser>>(requireCompany = true, userRepository = userRepository) { auth ->
      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val companyId = companyIdStr.toUuid()

      if (auth.user.companyId != companyId) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<List<FIUser>>(false, "Not authorized"))
      }

      val users = userRepository.getByCompanyId(companyId)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = users))
    }
  }

  // POST /companies/{id}/users/{userId}/promote - Promote user to admin
  post("/companies/{id}/users/{userId}/promote") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val requester = auth.user
      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      if (requester.companyId != companyId || !requester.role.isAdmin) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to promote users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot change role of company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.update(userId = targetUserId, role = UserRole.ADMIN)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true)))
    }
  }

  // POST /companies/{id}/users/{userId}/demote - Demote user from admin
  post("/companies/{id}/users/{userId}/demote") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val requester = auth.user
      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      if (requester.companyId != companyId || !requester.role.isAdmin) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to demote users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot change role of company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.update(userId = targetUserId, role = UserRole.USER)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true)))
    }
  }

  // DELETE /companies/{id}/users/{userId} - Remove user from company
  delete("/companies/{id}/users/{userId}") {
    call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
      val requester = auth.user
      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      if (requester.companyId != companyId || !requester.role.isAdmin) {
        return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to remove users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot remove company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.clearCompanyId(targetUserId)
      call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true)))
    }
  }
}

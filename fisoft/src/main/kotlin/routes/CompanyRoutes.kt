package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.CompanyRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
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
import kotlin.uuid.Uuid

fun Route.companyRoutes(companyRepository: CompanyRepository, userRepository: UserRepository) {

  // POST /companies - Create company
  post("/companies") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<Company>(false, "Unauthorized", error = "X-User-Id header missing"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Company>(false, "User not found"))

      if (user.companyId != null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Company>(false, "User already has a company"))
      }

      val request = call.receive<CreateCompanyRequest>()
      val company = companyRepository.create(name = request.name, address = request.address, creatorId = userId)

      // Creator becomes admin of the new company
      userRepository.update(userId = userId, companyId = company.id, role = UserRole.ADMIN)

      call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Company created", data = company))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Company>(false, "Failed to create company", error = e.message ?: "Unknown error"))
    }
  }

  // POST /companies/invite - Invite user to company
  post("/companies/invite") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<CompanyInvite>(false, "Unauthorized"))
      val inviterId = userIdHeader.toUuid()

      val inviter = userRepository.getById(inviterId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<CompanyInvite>(false, "Inviter not found"))

      if (inviter.companyId == null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "Bir şirkete üye değilsiniz"))
      }

      if (inviter.role == UserRole.USER) {
        return@post call.respond(HttpStatusCode.Forbidden, ServerResponse<CompanyInvite>(false, "User role cannot invite"))
      }

      val request = call.receive<InviteUserRequest>()
      val companyId = inviter.companyId

      // Check if already invited
      val existingInvite = companyRepository.findPendingInviteByPhoneAndCompany(request.phone, companyId)
      if (existingInvite != null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "User already invited"))
      }

      val invitedUser = userRepository.getByPhoneNumber(request.phone)
      if (invitedUser != null && invitedUser.companyId != null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "User is already in a company"))
      }

      val invite = companyRepository.createInvite(
        companyId = companyId,
        inviterUserId = inviterId,
        invitedUserId = invitedUser?.id,
        invitedPhoneNumber = request.phone
      )

      call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Invite created", data = invite))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<CompanyInvite>(false, "Failed to invite user", error = e.message ?: "Unknown error"))
    }
  }

  // POST /companies/invites/{id}/respond - Respond to invite
  post("/companies/invites/{id}/respond") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val inviteIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Invite ID is required")
      val inviteId = inviteIdStr.toUuid()

      val invite = companyRepository.getInviteById(inviteId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Invite not found"))

      if (invite.status != InviteStatus.PENDING) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Invite no longer pending"))
      }

      val request = call.receive<RespondInviteRequest>()
      if (!request.accept) {
        companyRepository.updateInviteStatus(inviteId, InviteStatus.REJECTED)
        return@post call.respond(ServerResponse(success = true, data = mapOf("success" to true), message = "Invite rejected"))
      }

      val user = userRepository.getById(userId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "User not found"))

      if (user.companyId != null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "You are already in a company"))
      }

      companyRepository.updateInviteStatus(inviteId, InviteStatus.ACCEPTED)
      userRepository.update(userId = userId, companyId = invite.companyId, role = UserRole.USER)

      call.respond(ServerResponse(success = true, data = mapOf("success" to true), message = "Invite accepted and user added to company"))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to respond to invite", error = e.message ?: "Unknown error"))
    }
  }

  // GET /companies/invites - Get company invites
  get("/companies/invites") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@get call.respond(HttpStatusCode.Unauthorized, ServerResponse<List<CompanyInvite>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@get call.respond(HttpStatusCode.NotFound, ServerResponse<List<CompanyInvite>>(false, "User not found"))

      if (user.companyId == null) {
        return@get call.respond(HttpStatusCode.BadRequest, ServerResponse<List<CompanyInvite>>(false, "Bir şirkete üye değilsiniz"))
      }

      val invites = companyRepository.findInvitesByCompanyId(user.companyId)
      call.respond(ServerResponse(success = true, data = invites))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<List<CompanyInvite>>(false, "Failed to fetch invites", error = e.message ?: "Unknown error"))
    }
  }

  // GET /companies/my-invites - Get my pending invites
  get("/companies/my-invites") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@get call.respond(HttpStatusCode.Unauthorized, ServerResponse<List<CompanyInvite>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@get call.respond(HttpStatusCode.NotFound, ServerResponse<List<CompanyInvite>>(false, "User not found"))

      val invites = companyRepository.findPendingInvitesByPhone(user.phoneNumber.value)
      call.respond(ServerResponse(success = true, data = invites))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<List<CompanyInvite>>(false, "Failed to fetch my invites", error = e.message ?: "Unknown error"))
    }
  }

  // GET /companies/my-company - Get my company details
  get("/companies/my-company") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@get call.respond(HttpStatusCode.Unauthorized, ServerResponse<Company?>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@get call.respond(HttpStatusCode.NotFound, ServerResponse<Company?>(false, "User not found"))

      val company = user.companyId?.let { companyRepository.getById(it) }
      call.respond(ServerResponse(success = true, data = company, message = "Company details fetched successfully"))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Company?>(false, "Failed to fetch company", error = e.message ?: "Unknown error"))
    }
  }

  // PUT /companies/name - Update company name
  put("/companies/name") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@put call.respond(HttpStatusCode.Unauthorized, ServerResponse<Company>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@put call.respond(HttpStatusCode.NotFound, ServerResponse<Company>(false, "User not found"))

      if (user.companyId == null) {
        return@put call.respond(HttpStatusCode.BadRequest, ServerResponse<Company>(false, "User is not in a company"))
      }

      if (!user.role.isAdmin) {
        return@put call.respond(HttpStatusCode.Forbidden, ServerResponse<Company>(false, "Only admins can update company name"))
      }

      val request = call.receive<UpdateCompanyNameRequest>()
      val updated = companyRepository.update(id = user.companyId, name = request.name)

      call.respond(ServerResponse(success = true, message = "Company name updated", data = updated))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Company>(false, "Failed to update company name", error = e.message ?: "Unknown error"))
    }
  }

  // DELETE /companies/me - Delete company (owner only)
  delete("/companies/me") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@delete call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Any>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Any>>(false, "User not found"))

      if (user.companyId == null) {
        return@delete call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Any>>(false, "User is not in a company"))
      }

      val companyId = user.companyId
      val company = companyRepository.getById(companyId)
        ?: return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Any>>(false, "Company not found"))

      if (company.creatorId != userId) {
        return@delete call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Any>>(false, "Only the company owner can delete the company"))
      }

      // Reset all users in the company
      val users = userRepository.getByCompanyId(companyId)
      users.forEach { u ->
        userRepository.clearCompanyId(u.id)
      }

      companyRepository.delete(companyId)

      call.respond(ServerResponse(success = true, data = mapOf("success" to true, "message" to "Company deleted successfully")))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Any>>(false, "Failed to delete company", error = e.message ?: "Unknown error"))
    }
  }

  // POST /companies/leave - Leave current company
  post("/companies/leave") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val user = userRepository.getById(userId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "User not found"))

      if (user.companyId == null) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "User is not in a company"))
      }

      val companyId = user.companyId
      val company = companyRepository.getById(companyId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == userId) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Company owner cannot leave the company"))
      }

      userRepository.clearCompanyId(userId)

      call.respond(ServerResponse(success = true, data = mapOf("success" to true)))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to leave company", error = e.message ?: "Unknown error"))
    }
  }

  // DELETE /companies/invites/{inviteId} - Delete an invite
  delete("/companies/invites/{inviteId}") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@delete call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val inviteIdStr = call.parameters["inviteId"] ?: throw IllegalArgumentException("Invite ID is required")
      val inviteId = inviteIdStr.toUuid()

      val requester = userRepository.getById(userId)
        ?: return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "User not found"))

      if (requester.companyId == null || !requester.role.isAdmin) {
        return@delete call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to delete invites"))
      }

      val invite = companyRepository.getInviteById(inviteId)
        ?: return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Invite not found"))

      if (invite.companyId != requester.companyId) {
        return@delete call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Invite belongs to another company"))
      }

      companyRepository.deleteInvite(inviteId)
      call.respond(ServerResponse(success = true, data = mapOf("success" to true)))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to delete invite", error = e.message ?: "Unknown error"))
    }
  }

  // GET /companies/{id}/users - Get users of a company
  get("/companies/{id}/users") {
    try {
      val userIdHeader = call.request.headers["X-User-Id"]
        ?: return@get call.respond(HttpStatusCode.Unauthorized, ServerResponse<List<FIUser>>(false, "Unauthorized"))
      val userId = userIdHeader.toUuid()

      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val companyId = companyIdStr.toUuid()

      val user = userRepository.getById(userId)
        ?: return@get call.respond(HttpStatusCode.NotFound, ServerResponse<List<FIUser>>(false, "User not found"))

      if (user.companyId != companyId) {
        return@get call.respond(HttpStatusCode.Forbidden, ServerResponse<List<FIUser>>(false, "Not authorized"))
      }

      val users = userRepository.getByCompanyId(companyId)
      call.respond(ServerResponse(success = true, data = users))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<List<FIUser>>(false, "Failed to fetch company users", error = e.message ?: "Unknown error"))
    }
  }

  // POST /companies/{id}/users/{userId}/promote - Promote user to admin
  post("/companies/{id}/users/{userId}/promote") {
    try {
      val requesterIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val requesterId = requesterIdHeader.toUuid()

      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      val requester = userRepository.getById(requesterId)
      if (requester == null || requester.companyId != companyId || !requester.role.isAdmin) {
        return@post call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to promote users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot change role of company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.update(userId = targetUserId, role = UserRole.ADMIN)
      call.respond(ServerResponse(success = true, data = mapOf("success" to true)))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to promote user", error = e.message ?: "Unknown error"))
    }
  }

  // POST /companies/{id}/users/{userId}/demote - Demote user from admin
  post("/companies/{id}/users/{userId}/demote") {
    try {
      val requesterIdHeader = call.request.headers["X-User-Id"]
        ?: return@post call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val requesterId = requesterIdHeader.toUuid()

      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      val requester = userRepository.getById(requesterId)
      if (requester == null || requester.companyId != companyId || !requester.role.isAdmin) {
        return@post call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to demote users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@post call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot change role of company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@post call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.update(userId = targetUserId, role = UserRole.USER)
      call.respond(ServerResponse(success = true, data = mapOf("success" to true)))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to demote user", error = e.message ?: "Unknown error"))
    }
  }

  // DELETE /companies/{id}/users/{userId} - Remove user from company
  delete("/companies/{id}/users/{userId}") {
    try {
      val requesterIdHeader = call.request.headers["X-User-Id"]
        ?: return@delete call.respond(HttpStatusCode.Unauthorized, ServerResponse<Map<String, Boolean>>(false, "Unauthorized"))
      val requesterId = requesterIdHeader.toUuid()

      val companyIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Company ID is required")
      val targetUserIdStr = call.parameters["userId"] ?: throw IllegalArgumentException("Target User ID is required")

      val companyId = companyIdStr.toUuid()
      val targetUserId = targetUserIdStr.toUuid()

      val requester = userRepository.getById(requesterId)
      if (requester == null || requester.companyId != companyId || !requester.role.isAdmin) {
        return@delete call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Not authorized to remove users"))
      }

      val company = companyRepository.getById(companyId)
        ?: return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Company not found"))

      if (company.creatorId == targetUserId) {
        return@delete call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Cannot remove company owner"))
      }

      val targetUser = userRepository.getById(targetUserId)
      if (targetUser == null || targetUser.companyId != companyId) {
        return@delete call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Target user not found in company"))
      }

      userRepository.clearCompanyId(targetUserId)
      call.respond(ServerResponse(success = true, data = mapOf("success" to true)))
    } catch (e: Exception) {
      call.respond(HttpStatusCode.BadRequest, ServerResponse<Map<String, Boolean>>(false, "Failed to remove user from company", error = e.message ?: "Unknown error"))
    }
  }
}

package com.ilyasdemirkiran.services

import com.google.firebase.auth.FirebaseAuth
import com.ilyasdemirkiran.config.FirebaseConfig
import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CompanyRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.utils.Logger
import io.ktor.http.*
import java.time.Instant

class AuthService(
    private val userRepo: UserRepository = UserRepository(),
    private val companyRepo: CompanyRepository = CompanyRepository()
) {
    suspend fun registerUser(token: String, name: String, surname: String): FIUser {
        val decoded = FirebaseConfig.verifyToken(token)
        val uid = decoded.uid
        val phoneNumber = decoded.claims["phone_number"] as? String

        if (phoneNumber.isNullOrEmpty()) {
            throw AppError(HttpStatusCode.BadRequest, "Phone number required in token", "INVALID_TOKEN")
        }

        val existing = userRepo.findById(uid)
        if (existing != null) {
            Logger.info("User already exists, returning existing user $uid")
            return existing
        }

        val existingByPhone = userRepo.findByPhoneNumber(phoneNumber)
        if (existingByPhone != null) {
            throw AppError(HttpStatusCode.Conflict, "Bu telefon numarası zaten kayıtlı", "PHONE_NUMBER_ALREADY_EXISTS")
        }

        val newUser = FIUser(
            _id = uid,
            phoneNumber = phoneNumber,
            name = name,
            surname = surname,
            role = UserRole.user,
            createdAt = Instant.now().toString()
        )

        return userRepo.create(newUser)
    }

    suspend fun isNumberRegistered(phoneNumber: String): Map<String, Boolean> {
        val user = userRepo.findByPhoneNumber(phoneNumber)
        return mapOf(
            "registered" to (user != null),
            "hasCompany" to (user?.companyId != null)
        )
    }

    suspend fun getUserById(userId: String): FIUser {
        return userRepo.findById(userId)
            ?: throw AppError(HttpStatusCode.NotFound, "User not found", "USER_NOT_FOUND")
    }

    suspend fun updateProfile(userId: String, name: String, surname: String): FIUser {
        val user = userRepo.findById(userId)
            ?: throw AppError(HttpStatusCode.NotFound, "User not found", "USER_NOT_FOUND")

        return userRepo.update(userId, name = name, surname = surname)
            ?: throw AppError(HttpStatusCode.InternalServerError, "Failed to update profile", "UPDATE_FAILED")
    }

    suspend fun deleteAccount(userId: String) {
        val user = userRepo.findById(userId)
            ?: throw AppError(HttpStatusCode.NotFound, "User not found", "USER_NOT_FOUND")

        if (user.companyId != null) {
            val company = companyRepo.findById(user.companyId)
            if (company != null && company.creatorUserId == userId) {
                val companyService = CompanyService()
                companyService.deleteCompany(userId)
            } else {
                companyRepo.removeUser(user.companyId, userId)
            }
        }

        userRepo.delete(userId)

        try {
            FirebaseAuth.getInstance().deleteUser(userId)
            Logger.info("Deleted user from Firebase Auth $userId")
        } catch (e: Exception) {
            Logger.error("Failed to delete user from Firebase Auth", e)
        }
    }
}

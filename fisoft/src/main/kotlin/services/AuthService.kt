package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.repository.SessionRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.FIUser
import com.ilyasdemirkiran.types.Session
import com.ilyasdemirkiran.types.UserRole
import org.mindrot.jbcrypt.BCrypt
import java.security.SecureRandom
import java.util.Base64
import kotlin.uuid.Uuid

class AuthService(
  private val userRepository: UserRepository = UserRepository(),
  private val sessionRepository: SessionRepository = SessionRepository()
) {
  private val secureRandom = SecureRandom()

  fun hashPassword(password: String): String {
    return BCrypt.hashpw(password, BCrypt.gensalt())
  }

  fun verifyPassword(password: String, hashed: String): Boolean {
    return BCrypt.checkpw(password, hashed)
  }

  fun generateToken(): String {
    val randomBytes = ByteArray(32)
    secureRandom.nextBytes(randomBytes)
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes)
  }

  fun registerUser(
    phoneNumber: String,
    passwordRaw: String,
    name: String,
    surname: String,
    companyId: Uuid? = null,
    role: UserRole = UserRole.USER
  ): FIUser {
    val existing = userRepository.getByPhoneNumber(phoneNumber)
    if (existing != null) {
      throw IllegalArgumentException("Phone number already registered")
    }

    val passwordHash = hashPassword(passwordRaw)
    return userRepository.create(
      phoneNumber = phoneNumber,
      passwordHash = passwordHash,
      name = name,
      surname = surname,
      companyId = companyId,
      role = role
    )
  }

  fun login(phoneNumber: String, passwordRaw: String): Session {
    val user = userRepository.getByPhoneNumber(phoneNumber)
      ?: throw IllegalArgumentException("Invalid phone number or password")

    val storedHash = userRepository.getPasswordHashByPhoneNumber(phoneNumber)
      ?: throw IllegalArgumentException("Invalid phone number or password")

    if (!verifyPassword(passwordRaw, storedHash)) {
      throw IllegalArgumentException("Invalid phone number or password")
    }

    val token = generateToken()
    return sessionRepository.createSession(
      userId = user.id,
      phoneNumber = user.phoneNumber.value,
      companyId = user.companyId,
      role = user.role,
      token = token
    )
  }

  fun validateSession(token: String): Session? {
    return sessionRepository.getValidSessionByToken(token)
  }

  fun logout(token: String): Boolean {
    return sessionRepository.deleteSessionByToken(token)
  }
}

package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.*
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.uuid.Uuid

class SessionRepository {

  fun createSession(
    userId: Uuid,
    phoneNumber: String,
    companyId: Uuid?,
    role: UserRole,
    token: String,
    durationHours: Long = 24 * 30 // 30 days default
  ): Session {
    return transaction {
      val id = Uuid.random()
      val createdAt = Instant.now()
      val expiresAt = createdAt.plus(durationHours, ChronoUnit.HOURS)

      SessionsTable.insert {
        it[SessionsTable.id] = id
        it[SessionsTable.userId] = userId
        it[SessionsTable.phoneNumber] = phoneNumber
        it[SessionsTable.companyId] = companyId
        it[SessionsTable.role] = role
        it[SessionsTable.token] = token
        it[SessionsTable.createdAt] = createdAt
        it[SessionsTable.expiresAt] = expiresAt
      }

      Session(
        id = id,
        userId = userId,
        phoneNumber = PhoneNumber(phoneNumber),
        companyId = companyId,
        role = role,
        token = token,
        createdAt = createdAt,
        expiresAt = expiresAt
      )
    }
  }

  fun getValidSessionByToken(token: String): Session? {
    return transaction {
      val now = Instant.now()
      SessionsTable.selectAll()
        .where { (SessionsTable.token eq token) and (SessionsTable.expiresAt greater now) }
        .map { it.toSession() }
        .firstOrNull()
    }
  }

  fun deleteSessionByToken(token: String): Boolean {
    return transaction {
      SessionsTable.deleteWhere { SessionsTable.token eq token } > 0
    }
  }

  fun deleteAllUserSessions(userId: Uuid): Int {
    return transaction {
      SessionsTable.deleteWhere { SessionsTable.userId eq userId }
    }
  }
}

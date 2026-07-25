package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.*
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.*
import kotlin.uuid.Uuid
import kotlin.uuid.toJavaUuid

class UserRepository {

  fun getAll(): List<FIUser> = transaction {
    FIUsers.selectAll()
      .map { it.toFIUser() }
  }

  fun create(phoneNumber: String, name: String, surname: String, companyId: Uuid? = null): FIUser {
    return transaction {
      val id = Uuid.random()
      val createdAt = Instant.now()

      FIUsers.insert {
        it[FIUsers.id] = id.toJavaUuid()
        it[FIUsers.phoneNumber] = phoneNumber
        it[FIUsers.name] = name
        it[FIUsers.surname] = surname
        it[FIUsers.companyId] = companyId
        it[FIUsers.role] = UserRole.USER
        it[FIUsers.createdAt] = createdAt
      }

      FIUser(
        id = id,
        phoneNumber = PhoneNumber(phoneNumber),
        name = name,
        surname = surname,
        companyId = companyId,
        role = UserRole.USER,
        createdAt = createdAt
      )
    }
  }

  fun update(userId: UUID, phoneNumber: String? = null, name: String? = null, surname: String? = null): FIUser? {
    return transaction {
      FIUsers.update({ FIUsers.id eq userId }) { update ->
        phoneNumber?.let { update[FIUsers.phoneNumber] = it }
        name?.let { update[FIUsers.name] = it }
        surname?.let { update[FIUsers.surname] = it }
      }

      FIUsers.selectAll().where { FIUsers.id eq userId }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }

  fun delete(userId: UUID): Boolean {
    return transaction {
      val deleted = FIUsers.deleteWhere { FIUsers.id eq userId }
      deleted > 0
    }
  }

  fun getById(userId: UUID): FIUser? {
    return transaction {
      FIUsers.selectAll().where { FIUsers.id eq userId }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }

  fun getByPhoneNumber(phoneNumber: String): FIUser? {
    return transaction {
      FIUsers.selectAll().where { FIUsers.phoneNumber eq phoneNumber }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }
}


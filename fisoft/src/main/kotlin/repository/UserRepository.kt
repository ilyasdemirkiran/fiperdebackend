package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.*
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class UserRepository {

  fun getAll(): List<FIUser> = transaction {
    FIUsersTable.selectAll()
      .map { it.toFIUser() }
  }

  fun create(phoneNumber: String, passwordHash: String, name: String, surname: String, companyId: Uuid? = null, role: UserRole = UserRole.USER): FIUser {
    return transaction {
      val id = Uuid.random()
      val createdAt = Instant.now()

      FIUsersTable.insert {
        it[FIUsersTable.id] = id
        it[FIUsersTable.phoneNumber] = phoneNumber
        it[FIUsersTable.passwordHash] = passwordHash
        it[FIUsersTable.name] = name
        it[FIUsersTable.surname] = surname
        it[FIUsersTable.companyId] = companyId
        it[FIUsersTable.role] = role
        it[FIUsersTable.createdAt] = createdAt
      }

      FIUser(
        id = id,
        phoneNumber = PhoneNumber(phoneNumber),
        name = name,
        surname = surname,
        companyId = companyId,
        role = role,
        createdAt = createdAt
      )
    }
  }

  fun update(userId: Uuid, phoneNumber: String? = null, passwordHash: String? = null, name: String? = null, surname: String? = null, companyId: Uuid? = null, role: UserRole? = null): FIUser? {
    return transaction {
      FIUsersTable.update({ FIUsersTable.id eq userId }) { update ->
        phoneNumber?.let { update[FIUsersTable.phoneNumber] = it }
        passwordHash?.let { update[FIUsersTable.passwordHash] = it }
        name?.let { update[FIUsersTable.name] = it }
        surname?.let { update[FIUsersTable.surname] = it }
        companyId?.let { update[FIUsersTable.companyId] = it }
        role?.let { update[FIUsersTable.role] = it }
      }

      FIUsersTable.selectAll().where { FIUsersTable.id eq userId }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }

  fun clearCompanyId(userId: Uuid): Boolean {
    return transaction {
      FIUsersTable.update({ FIUsersTable.id eq userId }) { update ->
        update[FIUsersTable.companyId] = null
        update[FIUsersTable.role] = UserRole.USER
      } > 0
    }
  }

  fun getByCompanyId(companyId: Uuid): List<FIUser> {
    return transaction {
      FIUsersTable.selectAll()
        .where { (FIUsersTable.companyId eq companyId) and (FIUsersTable.role neq UserRole.SUDO) }
        .map { it.toFIUser() }
    }
  }

  fun delete(userId: Uuid): Boolean {
    return transaction {
      val deleted = FIUsersTable.deleteWhere { FIUsersTable.id eq userId }
      deleted > 0
    }
  }

  fun getById(userId: Uuid): FIUser? {
    return transaction {
      FIUsersTable.selectAll().where { FIUsersTable.id eq userId }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }

  fun getByPhoneNumber(phoneNumber: String): FIUser? {
    return transaction {
      FIUsersTable.selectAll().where { FIUsersTable.phoneNumber eq phoneNumber }
        .map { it.toFIUser() }
        .firstOrNull()
    }
  }

  fun getPasswordHashByPhoneNumber(phoneNumber: String): String? {
    return transaction {
      FIUsersTable.selectAll().where { FIUsersTable.phoneNumber eq phoneNumber }
        .map { it[FIUsersTable.passwordHash] }
        .firstOrNull()
    }
  }
}

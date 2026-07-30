package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.customers.CustomerNote
import com.ilyasdemirkiran.types.customers.CustomerNotesTable
import com.ilyasdemirkiran.types.customers.toCustomerNote
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class CustomerNoteRepository {

  fun createNote(
    customerId: Uuid,
    companyId: Uuid,
    userId: Uuid,
    note: String
  ): CustomerNote = transaction {
    val id = Uuid.random()
    val now = Instant.now()

    CustomerNotesTable.insert {
      it[CustomerNotesTable.id] = id
      it[CustomerNotesTable.customerId] = customerId
      it[CustomerNotesTable.companyId] = companyId
      it[CustomerNotesTable.userId] = userId
      it[CustomerNotesTable.note] = note
      it[CustomerNotesTable.createdAt] = now
      it[CustomerNotesTable.updatedAt] = now
    }

    val userName = FIUsersTable.selectAll()
      .where { FIUsersTable.id eq userId }
      .map { "${it[FIUsersTable.name]} ${it[FIUsersTable.surname]}" }
      .firstOrNull()

    CustomerNote(
      id = id,
      customerId = customerId,
      companyId = companyId,
      userId = userId,
      note = note,
      createdAt = now,
      updatedAt = now,
      userName = userName
    )
  }

  fun getNotesByCustomerId(customerId: Uuid, companyId: Uuid): List<CustomerNote> = transaction {
    val rows = (CustomerNotesTable innerJoin FIUsersTable)
      .selectAll()
      .where { (CustomerNotesTable.customerId eq customerId) and (CustomerNotesTable.companyId eq companyId) }
      .orderBy(CustomerNotesTable.createdAt to org.jetbrains.exposed.v1.core.SortOrder.DESC)

    rows.map { row ->
      val name = row[FIUsersTable.name]
      val surname = row[FIUsersTable.surname]
      row.toCustomerNote(userName = "$name $surname")
    }
  }

  fun getNoteById(noteId: Uuid, companyId: Uuid): CustomerNote? = transaction {
    val rows = (CustomerNotesTable innerJoin FIUsersTable)
      .selectAll()
      .where { (CustomerNotesTable.id eq noteId) and (CustomerNotesTable.companyId eq companyId) }

    rows.map { row ->
      val name = row[FIUsersTable.name]
      val surname = row[FIUsersTable.surname]
      row.toCustomerNote(userName = "$name $surname")
    }.firstOrNull()
  }

  fun updateNote(
    noteId: Uuid,
    companyId: Uuid,
    newNote: String
  ): CustomerNote? = transaction {
    val now = Instant.now()
    val updated = CustomerNotesTable.update({ (CustomerNotesTable.id eq noteId) and (CustomerNotesTable.companyId eq companyId) }) { update ->
      update[CustomerNotesTable.note] = newNote
      update[CustomerNotesTable.updatedAt] = now
    }

    if (updated > 0) {
      getNoteById(noteId, companyId)
    } else {
      null
    }
  }

  fun deleteNote(noteId: Uuid, companyId: Uuid): Boolean = transaction {
    CustomerNotesTable.deleteWhere { (CustomerNotesTable.id eq noteId) and (CustomerNotesTable.companyId eq companyId) } > 0
  }
}

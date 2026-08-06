package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CustomerNoteRepository
import com.ilyasdemirkiran.types.customers.CustomerNote
import io.ktor.http.*
import java.time.Instant

class CustomerNoteService(
    private val repo: CustomerNoteRepository = CustomerNoteRepository()
) {
    suspend fun getCustomerNotes(companyId: String, customerId: String): List<CustomerNote> {
        return repo.findByCustomerId(companyId, customerId)
    }

    suspend fun createNote(companyId: String, customerId: String, userId: String, noteText: String): CustomerNote {
        val note = CustomerNote(
            customerId = customerId,
            userId = userId,
            note = noteText,
            createdAt = Instant.now().toString()
        )
        return repo.create(companyId, note)
    }

    suspend fun updateNote(companyId: String, noteId: String, noteText: String): CustomerNote {
        return repo.update(companyId, noteId, noteText)
            ?: throw AppError(HttpStatusCode.NotFound, "Note not found", "NOT_FOUND")
    }

    suspend fun deleteNote(companyId: String, noteId: String) {
        if (!repo.delete(companyId, noteId)) {
            throw AppError(HttpStatusCode.NotFound, "Note not found", "NOT_FOUND")
        }
    }
}

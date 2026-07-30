package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.CustomerRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.customers.Customer
import com.ilyasdemirkiran.types.request.CreateCustomerRequest
import com.ilyasdemirkiran.types.request.UpdateCustomerRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

import com.ilyasdemirkiran.repository.CustomerNoteRepository
import com.ilyasdemirkiran.types.customers.CustomerNote
import com.ilyasdemirkiran.types.request.CreateCustomerNoteRequest
import com.ilyasdemirkiran.types.request.UpdateCustomerNoteRequest

fun Route.customerRoutes(
  customerRepository: CustomerRepository,
  userRepository: UserRepository,
  customerNoteRepository: CustomerNoteRepository = CustomerNoteRepository()
) {
  route("/customers") {

    // GET /customers - List all customers for user's company
    get {
      call.authenticate<List<Customer>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val customers = customerRepository.getByCompanyId(companyId)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Customers retrieved successfully", data = customers))
      }
    }

    // POST /customers - Create a customer
    post {
      call.authenticate<Customer>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateCustomerRequest>()
        val customer = customerRepository.create(
          companyId = companyId,
          name = request.name,
          surname = request.surname,
          phoneNumber = request.phoneNumber,
          city = request.city,
          district = request.district,
          address = request.address,
          status = request.status
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Customer created successfully", data = customer))
      }
    }

    // GET /customers/{id} - Get customer by ID
    get("/{id}") {
      call.authenticate<Customer>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Customer ID is required")
        val customerId = idStr.toUuid()

        val customer = customerRepository.getById(customerId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Customer>(false, "Customer not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Customer retrieved successfully", data = customer))
      }
    }

    // PUT /customers/{id} - Update customer
    put("/{id}") {
      call.authenticate<Customer>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Customer ID is required")
        val customerId = idStr.toUuid()

        val request = call.receive<UpdateCustomerRequest>()
        val updated = customerRepository.update(
          id = customerId,
          companyId = companyId,
          name = request.name,
          surname = request.surname,
          phoneNumber = request.phoneNumber,
          city = request.city,
          district = request.district,
          address = request.address,
          status = request.status
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Customer>(false, "Customer not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Customer updated successfully", data = updated))
      }
    }

    // DELETE /customers/{id} - Delete customer
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Customer ID is required")
        val customerId = idStr.toUuid()

        val deleted = customerRepository.delete(customerId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Customer deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Customer not found"))
        }
      }
    }

    // GET /customers/{id}/notes - Get all notes for a customer
    get("/{id}/notes") {
      call.authenticate<List<CustomerNote>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val customerIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Customer ID is required")
        val customerId = customerIdStr.toUuid()

        val notes = customerNoteRepository.getNotesByCustomerId(customerId, companyId)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = notes, message = "Customer notes retrieved successfully"))
      }
    }

    // POST /customers/{id}/notes - Add a note to a customer
    post("/{id}/notes") {
      call.authenticate<CustomerNote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val userId = auth.user.id
        val customerIdStr = call.parameters["id"] ?: throw IllegalArgumentException("Customer ID is required")
        val customerId = customerIdStr.toUuid()

        val customer = customerRepository.getById(customerId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<CustomerNote>(false, "Customer not found"))

        val request = call.receive<CreateCustomerNoteRequest>()
        val note = customerNoteRepository.createNote(
          customerId = customer.id,
          companyId = companyId,
          userId = userId,
          note = request.note
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Note added successfully", data = note))
      }
    }

    // PUT /customers/notes/{noteId} - Update a note (Owner only)
    put("/notes/{noteId}") {
      call.authenticate<CustomerNote>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val userId = auth.user.id
        val noteIdStr = call.parameters["noteId"] ?: throw IllegalArgumentException("Note ID is required")
        val noteId = noteIdStr.toUuid()

        val existingNote = customerNoteRepository.getNoteById(noteId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<CustomerNote>(false, "Note not found"))

        if (existingNote.userId != userId) {
          return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<CustomerNote>(false, "Only the author can edit this note"))
        }

        val request = call.receive<UpdateCustomerNoteRequest>()
        val updated = customerNoteRepository.updateNote(noteId, companyId, request.note)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<CustomerNote>(false, "Note not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Note updated successfully", data = updated))
      }
    }

    // DELETE /customers/notes/{noteId} - Delete a note (Owner only)
    delete("/notes/{noteId}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val userId = auth.user.id
        val noteIdStr = call.parameters["noteId"] ?: throw IllegalArgumentException("Note ID is required")
        val noteId = noteIdStr.toUuid()

        val existingNote = customerNoteRepository.getNoteById(noteId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Note not found"))

        if (existingNote.userId != userId) {
          return@authenticate call.respond(HttpStatusCode.Forbidden, ServerResponse<Map<String, Boolean>>(false, "Only the author can delete this note"))
        }

        val deleted = customerNoteRepository.deleteNote(noteId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Note deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Note not found"))
        }
      }
    }
  }
}

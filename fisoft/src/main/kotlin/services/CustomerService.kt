package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.CustomerNoteRepository
import com.ilyasdemirkiran.repository.CustomerRepository
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.customers.Customer
import io.ktor.http.*
import java.time.Instant

class CustomerService(
    private val repo: CustomerRepository = CustomerRepository(),
    private val noteRepo: CustomerNoteRepository = CustomerNoteRepository()
) {
    suspend fun createCustomer(companyId: String, name: String, surname: String, phone: String? = null, city: String? = null, district: String? = null, address: String? = null): Customer {
        val customer = Customer(
            name = name,
            surname = surname,
            phone = phone,
            city = city,
            district = district,
            address = address,
            status = "active",
            createdAt = Instant.now().toString()
        )
        return repo.create(companyId, customer)
    }

    suspend fun getCustomer(companyId: String, id: String): Customer {
        return repo.findById(companyId, id)
            ?: throw AppError(HttpStatusCode.NotFound, "Customer not found", "CUSTOMER_NOT_FOUND")
    }

    suspend fun listCustomers(companyId: String, page: Int, limit: Int, status: String? = null, search: String? = null): Pair<List<Customer>, Long> {
        return repo.findAll(companyId, page, limit, status, search)
    }

    suspend fun getAllCustomers(companyId: String, status: String? = null): List<Customer> {
        return repo.getAll(companyId, status)
    }

    suspend fun updateCustomer(companyId: String, id: String, name: String? = null, surname: String? = null, phone: String? = null, city: String? = null, district: String? = null, address: String? = null, status: String? = null): Customer {
        if (!repo.exists(companyId, id)) {
            throw AppError(HttpStatusCode.NotFound, "Customer not found", "CUSTOMER_NOT_FOUND")
        }

        return repo.update(companyId, id, name, surname, phone, city, district, address, status)
            ?: throw AppError(HttpStatusCode.InternalServerError, "Failed to update customer", "UPDATE_FAILED")
    }

    suspend fun deleteCustomer(companyId: String, id: String, userRole: UserRole) {
        if (!repo.exists(companyId, id)) {
            throw AppError(HttpStatusCode.NotFound, "Customer not found", "CUSTOMER_NOT_FOUND")
        }

        if (userRole == UserRole.user) {
            repo.update(companyId, id, status = "inactive")
        } else {
            repo.delete(companyId, id)
        }
    }
}

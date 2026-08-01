package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.customers.Customer
import com.ilyasdemirkiran.types.customers.CustomerStatus
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.types.customers.toCustomer
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class CustomerRepository {

  fun create(
    companyId: Uuid,
    name: String,
    surname: String,
    phoneNumber: String? = null,
    city: String? = null,
    district: String? = null,
    address: String? = null,
    status: CustomerStatus = CustomerStatus.Active
  ): Customer = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    CustomersTable.insert {
      it[CustomersTable.id] = id
      it[CustomersTable.companyId] = companyId
      it[CustomersTable.name] = name
      it[CustomersTable.surname] = surname
      it[CustomersTable.phoneNumber] = phoneNumber
      it[CustomersTable.city] = city
      it[CustomersTable.district] = district
      it[CustomersTable.address] = address
      it[CustomersTable.status] = status
      it[CustomersTable.createdAt] = createdAt
    }

    Customer(
      id = id,
      companyId = companyId,
      name = name,
      surname = surname,
      phoneNumber = phoneNumber,
      city = city,
      district = district,
      address = address,
      status = status,
      createdAt = createdAt
    )
  }

  fun getById(id: Uuid, companyId: Uuid): Customer? = transaction {
    CustomersTable.selectAll()
      .where { (CustomersTable.id eq id) and (CustomersTable.companyId eq companyId) }
      .map { it.toCustomer() }
      .firstOrNull()
  }

  fun getByCompanyId(
    companyId: Uuid,
    search: String? = null,
    page: Int = 1,
    size: Int = 30
  ): com.ilyasdemirkiran.types.response.PaginatedResponseData<Customer> = transaction {
    val queryTrimmed = search?.trim()

    val baseQuery = if (queryTrimmed.isNullOrEmpty()) {
      CustomersTable.selectAll()
        .where { CustomersTable.companyId eq companyId }
    } else {
      val pattern = "%${queryTrimmed.lowercase()}%"
      CustomersTable.selectAll()
        .where {
          (CustomersTable.companyId eq companyId) and (
            (CustomersTable.name.lowerCase() like pattern) or
              (CustomersTable.surname.lowerCase() like pattern) or
              (CustomersTable.phoneNumber.lowerCase() like pattern) or
              (CustomersTable.city.lowerCase() like pattern) or
              (CustomersTable.district.lowerCase() like pattern) or
              (CustomersTable.address.lowerCase() like pattern)
          )
        }
    }

    val totalAllCompanyCustomers = CustomersTable.selectAll()
      .where { CustomersTable.companyId eq companyId }
      .count()

    val filteredTotal = baseQuery.count()
    val totalPages = if (filteredTotal == 0L) 1 else kotlin.math.ceil(filteredTotal.toDouble() / size).toInt()
    val currentPage = page.coerceAtLeast(1)
    val offset = ((currentPage - 1) * size).toLong()

    val items = baseQuery
      .orderBy(CustomersTable.createdAt to SortOrder.DESC)
      .limit(size)
      .offset(offset)
      .map { it.toCustomer() }

    com.ilyasdemirkiran.types.response.PaginatedResponseData(
      items = items,
      total = totalAllCompanyCustomers,
      filteredTotal = filteredTotal,
      page = currentPage,
      size = size,
      totalPages = totalPages
    )
  }

  fun update(
    id: Uuid,
    companyId: Uuid,
    name: String? = null,
    surname: String? = null,
    phoneNumber: String? = null,
    city: String? = null,
    district: String? = null,
    address: String? = null,
    status: CustomerStatus? = null
  ): Customer? = transaction {
    CustomersTable.update({ (CustomersTable.id eq id) and (CustomersTable.companyId eq companyId) }) { update ->
      name?.let { update[CustomersTable.name] = it }
      surname?.let { update[CustomersTable.surname] = it }
      phoneNumber?.let { update[CustomersTable.phoneNumber] = it }
      city?.let { update[CustomersTable.city] = it }
      district?.let { update[CustomersTable.district] = it }
      address?.let { update[CustomersTable.address] = it }
      status?.let { update[CustomersTable.status] = it }
    }

    getById(id, companyId)
  }

  fun delete(id: Uuid, companyId: Uuid): Boolean = transaction {
    CustomersTable.deleteWhere { (CustomersTable.id eq id) and (CustomersTable.companyId eq companyId) } > 0
  }
}
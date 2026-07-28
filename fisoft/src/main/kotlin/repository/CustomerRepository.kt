package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.customers.Customer
import com.ilyasdemirkiran.types.customers.CustomerStatus
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.types.customers.toCustomer
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
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

  fun getByCompanyId(companyId: Uuid): List<Customer> = transaction {
    CustomersTable.selectAll()
      .where { CustomersTable.companyId eq companyId }
      .map { it.toCustomer() }
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
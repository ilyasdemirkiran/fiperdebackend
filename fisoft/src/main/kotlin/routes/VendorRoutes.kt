package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.repository.VendorRepository
import com.ilyasdemirkiran.types.request.CreateVendorRequest
import com.ilyasdemirkiran.types.request.UpdateVendorRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.types.vendors.Vendor
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.vendorRoutes(vendorRepository: VendorRepository, userRepository: UserRepository) {
  route("/vendors") {

    // GET /vendors - List all vendors for company
    get {
      call.authenticate<List<Vendor>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val vendors = vendorRepository.getByCompanyId(companyId)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Vendors retrieved successfully", data = vendors))
      }
    }

    // POST /vendors - Create vendor
    post {
      call.authenticate<Vendor>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateVendorRequest>()
        val vendor = vendorRepository.create(
          companyId = companyId,
          name = request.name,
          phone = request.phone,
          city = request.city,
          district = request.district,
          address = request.address
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Vendor created successfully", data = vendor))
      }
    }

    // GET /vendors/{id} - Get vendor by ID
    get("/{id}") {
      call.authenticate<Vendor>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Vendor ID is required")
        val vendorId = idStr.toUuid()

        val vendor = vendorRepository.getById(vendorId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Vendor>(false, "Vendor not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Vendor retrieved successfully", data = vendor))
      }
    }

    // PUT /vendors/{id} - Update vendor
    put("/{id}") {
      call.authenticate<Vendor>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Vendor ID is required")
        val vendorId = idStr.toUuid()

        val request = call.receive<UpdateVendorRequest>()
        val updated = vendorRepository.update(
          id = vendorId,
          companyId = companyId,
          name = request.name,
          phone = request.phone,
          city = request.city,
          district = request.district,
          address = request.address
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Vendor>(false, "Vendor not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Vendor updated successfully", data = updated))
      }
    }

    // DELETE /vendors/{id} - Delete vendor
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Vendor ID is required")
        val vendorId = idStr.toUuid()

        val deleted = vendorRepository.delete(vendorId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Vendor deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Vendor not found"))
        }
      }
    }
  }
}

package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.ProductRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.repository.VendorRepository
import com.ilyasdemirkiran.types.products.Product
import com.ilyasdemirkiran.types.request.CreateProductRequest
import com.ilyasdemirkiran.types.request.UpdateProductRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.productRoutes(
  productRepository: ProductRepository,
  userRepository: UserRepository,
  vendorRepository: VendorRepository = VendorRepository()
) {
  route("/products") {

    // GET /products - List all products for company
    get {
      call.authenticate<List<Product>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val vendorIdParam = call.request.queryParameters["vendorId"]?.takeIf { it.isNotBlank() }

        val products = if (vendorIdParam != null) {
          productRepository.getByVendorId(vendorIdParam.toUuid(), companyId)
        } else {
          productRepository.getByCompanyId(companyId)
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Products retrieved successfully", data = products))
      }
    }

    // POST /products - Create product
    post {
      call.authenticate<Product>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val request = call.receive<CreateProductRequest>()
        val vendorUuid = request.vendorId?.takeIf { it.isNotBlank() }?.toUuid()

        // Eğer vendorId verilmişse, firmanın veritabanında var mı kontrol et
        if (vendorUuid != null) {
          val vendor = vendorRepository.getById(vendorUuid, companyId)
          if (vendor == null) {
            return@authenticate call.respond(
              HttpStatusCode.BadRequest,
              ServerResponse<Product>(false, "Invalid vendor", error = "Specified vendor does not exist in your company")
            )
          }
        }

        val product = productRepository.create(
          companyId = companyId,
          name = request.name,
          code = request.code,
          price = request.price,
          currency = request.currency,
          vendorId = vendorUuid,
          description = request.description
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Product created successfully", data = product))
      }
    }

    // GET /products/{id} - Get product by ID
    get("/{id}") {
      call.authenticate<Product>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Product ID is required")
        val productId = idStr.toUuid()

        val product = productRepository.getById(productId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Product>(false, "Product not found"))

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Product retrieved successfully", data = product))
      }
    }

    // PUT /products/{id} - Update product
    put("/{id}") {
      call.authenticate<Product>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Product ID is required")
        val productId = idStr.toUuid()

        val request = call.receive<UpdateProductRequest>()
        val vendorUuid = request.vendorId?.takeIf { it.isNotBlank() }?.toUuid()

        if (vendorUuid != null) {
          val vendor = vendorRepository.getById(vendorUuid, companyId)
          if (vendor == null) {
            return@authenticate call.respond(
              HttpStatusCode.BadRequest,
              ServerResponse<Product>(false, "Invalid vendor", error = "Specified vendor does not exist in your company")
            )
          }
        }

        val updated = productRepository.update(
          id = productId,
          companyId = companyId,
          name = request.name,
          code = request.code,
          price = request.price,
          currency = request.currency,
          vendorId = vendorUuid,
          description = request.description
        )

        if (updated == null) {
          return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Product>(false, "Product not found"))
        }

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Product updated successfully", data = updated))
      }
    }

    // DELETE /products/{id} - Delete product
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val idStr = call.parameters["id"] ?: throw IllegalArgumentException("Product ID is required")
        val productId = idStr.toUuid()

        val deleted = productRepository.delete(productId, companyId)
        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Product deleted successfully"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Product not found"))
        }
      }
    }
  }
}

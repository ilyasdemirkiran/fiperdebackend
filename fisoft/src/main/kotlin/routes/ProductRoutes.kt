package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.middleware.authenticateUser
import com.ilyasdemirkiran.middleware.currentCompanyId
import com.ilyasdemirkiran.middleware.currentUser
import com.ilyasdemirkiran.services.ProductService
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.utils.successResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class CreateProductReq(
    val name: String,
    val code: String,
    val price: Money,
    val currency: String = "TRY",
    val vendorId: String,
    val description: String? = null,
    val imageUrl: String? = null
)

fun Route.productRoutes() {
    val productService = ProductService()

    route("/api/products") {
        get {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val products = productService.listProductsForCompany(companyId)
            call.respond(HttpStatusCode.OK, successResponse(products))
        }

        get("/list/all") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val products = productService.listProductsForCompany(companyId)
            call.respond(HttpStatusCode.OK, successResponse(products))
        }

        get("/vendor/{vendorId}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val vendorId = call.parameters["vendorId"] ?: ""
            val products = productService.listProductsByVendor(vendorId, companyId)
            call.respond(HttpStatusCode.OK, successResponse(products))
        }

        post {
            call.authenticateUser()
            val user = call.currentUser
            val req = call.receive<CreateProductReq>()
            val product = productService.createProduct(user.role, req.name, req.code, req.price, req.currency, req.vendorId, req.description, req.imageUrl)
            call.respond(HttpStatusCode.Created, successResponse(product))
        }

        get("/{id}") {
            call.authenticateUser()
            val companyId = call.currentCompanyId
            val id = call.parameters["id"] ?: ""
            val product = productService.getProduct(id, companyId)
            call.respond(HttpStatusCode.OK, successResponse(product))
        }

        put("/{id}") {
            call.authenticateUser()
            val user = call.currentUser
            val id = call.parameters["id"] ?: ""
            val req = call.receive<CreateProductReq>()
            val updated = productService.updateProduct(user.role, id, req.name, req.code, req.price, req.currency, req.description, req.imageUrl)
            call.respond(HttpStatusCode.OK, successResponse(updated))
        }

        delete("/{id}") {
            call.authenticateUser()
            val user = call.currentUser
            val id = call.parameters["id"] ?: ""
            productService.deleteProduct(user.role, id)
            call.respond(HttpStatusCode.OK, successResponse(mapOf("success" to true)))
        }
    }
}

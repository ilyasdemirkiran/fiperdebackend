package com.ilyasdemirkiran

import com.ilyasdemirkiran.repository.*
import com.ilyasdemirkiran.routes.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    val userRepository = UserRepository()
    val companyRepository = CompanyRepository()
    val customerRepository = CustomerRepository()
    val vendorRepository = VendorRepository()
    val productRepository = ProductRepository()
    val saleRepository = SaleRepository()
    val mediaRepository = MediaRepository()

    routing {
        get("/") {
            call.respondText("Hello, World!")
        }

        authRoutes()
        userRoutes(userRepository)
        companyRoutes(companyRepository, userRepository)
        customerRoutes(customerRepository, userRepository)
        vendorRoutes(vendorRepository, userRepository)
        productRoutes(productRepository, userRepository)
        saleRoutes(saleRepository, userRepository)
        mediaRoutes(mediaRepository, userRepository, customerRepository)
    }
}
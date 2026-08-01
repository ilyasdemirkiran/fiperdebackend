package com.ilyasdemirkiran

import com.ilyasdemirkiran.repository.*
import com.ilyasdemirkiran.routes.*
import com.ilyasdemirkiran.services.MinioStorageService
import io.ktor.http.*
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
    val accountRepository = AccountRepository()
    val dashboardRepository = DashboardRepository()
    val quoteRepository = QuoteRepository()
    val mediaRepository = MediaRepository()

    routing {
        get("/") {
            call.respondText("Hello, World!")
        }

        authRoutes()
        userRoutes(userRepository)
        companyRoutes(companyRepository, userRepository)
        dashboardRoutes(dashboardRepository, userRepository)
        customerRoutes(customerRepository, userRepository)
        vendorRoutes(vendorRepository, userRepository)
        productRoutes(productRepository, userRepository)
        accountRoutes(accountRepository, saleRepository, userRepository)
        saleRoutes(saleRepository, userRepository)
        quoteRoutes(quoteRepository, userRepository)
        mediaRoutes(mediaRepository, userRepository, customerRepository)

        // Public Storage Endpoint for serving media/photos directly
        get("/storage/{path...}") {
            val path = call.parameters.getAll("path")?.joinToString("/")
            if (path.isNullOrEmpty()) {
                call.respond(HttpStatusCode.BadRequest, "Path is required")
                return@get
            }
            val minioService = MinioStorageService()
            val stream = minioService.getFile(path)
            if (stream == null) {
                call.respond(HttpStatusCode.NotFound, "File not found")
            } else {
                call.respondOutputStream(ContentType.defaultForFilePath(path)) {
                    stream.copyTo(this)
                }
            }
        }

        get("/api/storage/{path...}") {
            val path = call.parameters.getAll("path")?.joinToString("/")
            if (path.isNullOrEmpty()) {
                call.respond(HttpStatusCode.BadRequest, "Path is required")
                return@get
            }
            val minioService = MinioStorageService()
            val stream = minioService.getFile(path)
            if (stream == null) {
                call.respond(HttpStatusCode.NotFound, "File not found")
            } else {
                call.respondOutputStream(ContentType.defaultForFilePath(path)) {
                    stream.copyTo(this)
                }
            }
        }
    }
}
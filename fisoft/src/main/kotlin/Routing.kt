package com.ilyasdemirkiran

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import com.ilyasdemirkiran.db.DatabaseConnection
import com.ilyasdemirkiran.repository.CompanyRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.routes.companyRoutes
import com.ilyasdemirkiran.routes.userRoutes

fun Application.configureRouting() {
    val userRepository = UserRepository()
    val companyRepository = CompanyRepository()

    routing {
        get("/") {
            call.respondText("Hello, World!")
        }

        userRoutes(userRepository)
        companyRoutes(companyRepository, userRepository)
    }
}
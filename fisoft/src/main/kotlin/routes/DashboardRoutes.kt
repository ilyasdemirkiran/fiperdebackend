package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.DashboardRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.types.dashboard.DashboardData
import com.ilyasdemirkiran.types.response.ServerResponse
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.dashboardRoutes(
  dashboardRepository: DashboardRepository = DashboardRepository(),
  userRepository: UserRepository
) {
  route("/dashboard") {

    // GET /dashboard - Get dashboard overview statistics and recent entries for all modules (supports year, month & limit filter)
    // Example: GET /dashboard
    // Example: GET /dashboard?year=2026&month=8
    get {
      call.authenticate<DashboardData>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val yearParam = call.request.queryParameters["year"]?.toIntOrNull()
        val monthParam = call.request.queryParameters["month"]?.toIntOrNull()
        val limitParam = call.request.queryParameters["limit"]?.toIntOrNull() ?: 5

        val dashboardData = dashboardRepository.getDashboardData(
          companyId = companyId,
          year = yearParam,
          month = monthParam,
          recentLimit = limitParam
        )
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Dashboard data retrieved successfully", data = dashboardData))
      }
    }
  }
}

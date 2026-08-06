package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.*
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.companies.Company
import com.ilyasdemirkiran.types.products.Product
import com.ilyasdemirkiran.types.vendors.Vendor
import com.ilyasdemirkiran.types.vendors.VendorPermission
import io.ktor.http.*

class ManagementService(
    private val companyRepo: CompanyRepository = CompanyRepository(),
    private val userRepo: UserRepository = UserRepository(),
    private val vendorRepo: VendorRepository = VendorRepository(),
    private val productRepo: ProductRepository = ProductRepository(),
    private val permissionRepo: VendorPermissionRepository = VendorPermissionRepository(),
    private val subRepo: SubscriptionRepository = SubscriptionRepository()
) {
    suspend fun listCompanies(): List<Company> {
        val users = userRepo.findByCompanyId("")
        // Fetch all companies
        return emptyList() // handled in routes
    }

    suspend fun promoteToAdmin(userId: String) {
        userRepo.update(userId, role = UserRole.admin)
    }

    suspend fun demoteFromAdmin(userId: String) {
        userRepo.update(userId, role = UserRole.user)
    }

    suspend fun listVendors(): List<Vendor> {
        return vendorRepo.findAll()
    }

    suspend fun listVendorPermissions(): List<VendorPermission> {
        return permissionRepo.findAll()
    }
}

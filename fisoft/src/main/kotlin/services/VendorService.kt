package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.ProductRepository
import com.ilyasdemirkiran.repository.VendorPermissionRepository
import com.ilyasdemirkiran.repository.VendorPriceRateRepository
import com.ilyasdemirkiran.repository.VendorRepository
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.vendors.Vendor
import com.ilyasdemirkiran.types.vendors.VendorPriceRate
import io.ktor.http.*
import java.time.Instant

class VendorService(
    private val repo: VendorRepository = VendorRepository(),
    private val permissionRepo: VendorPermissionRepository = VendorPermissionRepository(),
    private val productRepo: ProductRepository = ProductRepository(),
    private val priceRateRepo: VendorPriceRateRepository = VendorPriceRateRepository()
) {
    private fun assertSudo(role: UserRole) {
        if (role != UserRole.sudo) {
            throw AppError(HttpStatusCode.Forbidden, "Only sudo users can perform this operation", "FORBIDDEN")
        }
    }

    suspend fun createVendor(role: UserRole, name: String, phone: String, city: String? = null, district: String? = null, address: String? = null): Vendor {
        assertSudo(role)
        val vendor = Vendor(
            name = name,
            phone = phone,
            city = city,
            district = district,
            address = address,
            createdAt = Instant.now().toString()
        )
        return repo.create(vendor)
    }

    suspend fun getVendor(id: String): Vendor {
        return repo.findById(id)
            ?: throw AppError(HttpStatusCode.NotFound, "Vendor not found", "VENDOR_NOT_FOUND")
    }

    suspend fun listAllVendors(): List<Vendor> {
        return repo.findAll()
    }

    suspend fun listVendorsForCompany(companyId: String): List<Vendor> {
        val allowedIds = permissionRepo.getVendorIdsForCompany(companyId)
        if (allowedIds.isEmpty()) return emptyList()
        return repo.findByIds(allowedIds)
    }

    suspend fun updateVendor(role: UserRole, id: String, name: String? = null, phone: String? = null, city: String? = null, district: String? = null, address: String? = null): Vendor {
        assertSudo(role)
        return repo.update(id, name, phone, city, district, address)
            ?: throw AppError(HttpStatusCode.NotFound, "Vendor not found", "VENDOR_NOT_FOUND")
    }

    suspend fun deleteVendor(role: UserRole, id: String) {
        assertSudo(role)
        if (!repo.delete(id)) {
            throw AppError(HttpStatusCode.NotFound, "Vendor not found", "VENDOR_NOT_FOUND")
        }
        productRepo.deleteByVendorId(id)
    }

    suspend fun grantPermission(role: UserRole, vendorId: String, companyId: String) {
        assertSudo(role)
        permissionRepo.addPermission(vendorId, companyId)
    }

    suspend fun revokePermission(role: UserRole, vendorId: String, companyId: String) {
        assertSudo(role)
        permissionRepo.removePermission(vendorId, companyId)
    }

    suspend fun getPriceRatesForCompany(companyId: String): List<VendorPriceRate> {
        val vendorIds = permissionRepo.getVendorIdsForCompany(companyId)
        if (vendorIds.isEmpty()) return emptyList()
        return priceRateRepo.findByVendorIds(companyId, vendorIds)
    }

    suspend fun updatePriceRate(companyId: String, role: UserRole, vendorId: String, rate: Double): VendorPriceRate {
        if (role != UserRole.admin && role != UserRole.sudo) {
            throw AppError(HttpStatusCode.Forbidden, "Only admin users can perform this operation", "FORBIDDEN")
        }
        return priceRateRepo.upsertRate(companyId, vendorId, rate)
    }
}

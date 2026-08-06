package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.ProductRepository
import com.ilyasdemirkiran.repository.VendorPermissionRepository
import com.ilyasdemirkiran.repository.VendorPriceRateRepository
import com.ilyasdemirkiran.repository.VendorRepository
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.UserRole
import com.ilyasdemirkiran.types.products.Product
import io.ktor.http.*
import java.time.Instant

class ProductService(
    private val repo: ProductRepository = ProductRepository(),
    private val vendorRepo: VendorRepository = VendorRepository(),
    private val permissionRepo: VendorPermissionRepository = VendorPermissionRepository(),
    private val priceRateRepo: VendorPriceRateRepository = VendorPriceRateRepository()
) {
    private fun assertSudo(role: UserRole) {
        if (role != UserRole.sudo) {
            throw AppError(HttpStatusCode.Forbidden, "Only sudo users can perform this operation", "FORBIDDEN")
        }
    }

    private suspend fun buildRateMap(companyId: String, vendorIds: List<String>): Map<String, Double> {
        val rates = priceRateRepo.findByVendorIds(companyId, vendorIds)
        return rates.mapNotNull { r -> if (r.vendorId != null) r.vendorId to (r.rate ?: 0.0) else null }.toMap()
    }

    private fun applyRates(products: List<Product>, rateMap: Map<String, Double>): List<Product> {
        return products.map { p ->
            val rate = rateMap[p.vendorId] ?: 0.0
            val priceWithRate = p.price * (1.0 + rate / 100.0)
            p.copy(priceWithRate = priceWithRate)
        }
    }

    suspend fun listProductsForCompany(companyId: String): List<Product> {
        val allowedVendorIds = permissionRepo.getVendorIdsForCompany(companyId)
        if (allowedVendorIds.isEmpty()) return emptyList()

        val products = repo.findByVendorIds(allowedVendorIds)
        val rateMap = buildRateMap(companyId, allowedVendorIds)
        return applyRates(products, rateMap)
    }

    suspend fun createProduct(role: UserRole, name: String, code: String, price: Money, currency: String, vendorId: String, description: String? = null, imageUrl: String? = null): Product {
        assertSudo(role)
        val vendor = vendorRepo.findById(vendorId)
            ?: throw AppError(HttpStatusCode.NotFound, "Vendor not found", "VENDOR_NOT_FOUND")

        val product = Product(
            name = name,
            code = code,
            price = price,
            currency = currency,
            vendorId = vendorId,
            vendorName = vendor.name,
            description = description,
            imageUrl = imageUrl,
            createdAt = Instant.now().toString()
        )

        return repo.create(product, vendorId)
    }

    suspend fun getProduct(id: String, companyId: String? = null): Product {
        val product = repo.findById(id)
            ?: throw AppError(HttpStatusCode.NotFound, "Product not found", "PRODUCT_NOT_FOUND")

        if (companyId != null) {
            val rateMap = buildRateMap(companyId, listOfNotNull(product.vendorId))
            return applyRates(listOf(product), rateMap).first()
        }
        return product
    }

    suspend fun listProductsByVendor(vendorId: String, companyId: String? = null): List<Product> {
        val products = repo.findByVendorId(vendorId)
        if (companyId != null && products.isNotEmpty()) {
            val rateMap = buildRateMap(companyId, listOf(vendorId))
            return applyRates(products, rateMap)
        }
        return products
    }

    suspend fun updateProduct(role: UserRole, id: String, name: String? = null, code: String? = null, price: Money? = null, currency: String? = null, description: String? = null, imageUrl: String? = null): Product {
        assertSudo(role)
        return repo.update(id, name, code, price, currency, description, imageUrl)
            ?: throw AppError(HttpStatusCode.NotFound, "Product not found", "PRODUCT_NOT_FOUND")
    }

    suspend fun deleteProduct(role: UserRole, id: String) {
        assertSudo(role)
        if (!repo.delete(id)) {
            throw AppError(HttpStatusCode.NotFound, "Product not found", "PRODUCT_NOT_FOUND")
        }
    }
}

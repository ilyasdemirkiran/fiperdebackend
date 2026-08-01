package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.accounts.AccountsTable
import com.ilyasdemirkiran.types.accounts.toAccount
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.types.customers.toCustomer
import com.ilyasdemirkiran.types.dashboard.DashboardData
import com.ilyasdemirkiran.types.dashboard.DashboardSummaryCounts
import com.ilyasdemirkiran.types.products.ProductsTable
import com.ilyasdemirkiran.types.products.toProduct
import com.ilyasdemirkiran.types.sales.SaleLogsTable
import com.ilyasdemirkiran.types.sales.SalesTable
import com.ilyasdemirkiran.types.sales.toSale
import com.ilyasdemirkiran.types.sales.toSaleLog
import com.ilyasdemirkiran.types.vendors.VendorsTable
import com.ilyasdemirkiran.types.vendors.toVendor
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import kotlin.uuid.Uuid

class DashboardRepository {

  fun getDashboardData(
    companyId: Uuid,
    year: Int? = null,
    month: Int? = null,
    recentLimit: Int = 5
  ): DashboardData = transaction {
    // Toplam sayılar
    val totalCustomers = CustomersTable.selectAll()
      .where { CustomersTable.companyId eq companyId }
      .count()

    val totalSales = SalesTable.selectAll()
      .where { SalesTable.companyId eq companyId }
      .count()

    val totalPaymentLogs = SaleLogsTable.selectAll()
      .where { SaleLogsTable.companyId eq companyId }
      .count()

    val totalProducts = ProductsTable.selectAll()
      .where { ProductsTable.companyId eq companyId }
      .count()

    val totalVendors = VendorsTable.selectAll()
      .where { VendorsTable.companyId eq companyId }
      .count()

    val totalAccounts = AccountsTable.selectAll()
      .where { AccountsTable.companyId eq companyId }
      .count()

    // Tarih aralığı (Year / Month hesabı)
    val now = Instant.now()
    val currentZoneDate = now.atZone(ZoneOffset.UTC)
    val selectedYear = year ?: currentZoneDate.year
    val selectedMonth = month ?: currentZoneDate.monthValue

    val selectedYearMonth = YearMonth.of(selectedYear, selectedMonth)
    val startOfMonth = selectedYearMonth.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant()
    val endOfMonth = selectedYearMonth.atEndOfMonth().atTime(23, 59, 59, 999_999_999).atZone(ZoneOffset.UTC).toInstant()

    val periodPaymentLogs = SaleLogsTable.selectAll()
      .where {
        (SaleLogsTable.companyId eq companyId) and
          (SaleLogsTable.paymentDate greaterEq startOfMonth) and
          (SaleLogsTable.paymentDate lessEq endOfMonth)
      }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .map { it.toSaleLog() }

    val selectedPeriodPaymentTotalAmount = periodPaymentLogs.sumOf { it.amount }
    val selectedPeriodPaymentCount = periodPaymentLogs.size.toLong()

    val periodSales = SalesTable.selectAll()
      .where {
        (SalesTable.companyId eq companyId) and
          (SalesTable.createdAt greaterEq startOfMonth) and
          (SalesTable.createdAt lessEq endOfMonth)
      }
      .orderBy(SalesTable.createdAt to SortOrder.DESC)
      .map { it.toSale() }

    val selectedPeriodSalesTotalAmount = periodSales.sumOf { it.totalAmount }
    val selectedPeriodSalesCount = periodSales.size.toLong()

    // Son N Kayıtlar
    val recentCustomers = CustomersTable.selectAll()
      .where { CustomersTable.companyId eq companyId }
      .orderBy(CustomersTable.createdAt to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toCustomer() }

    val recentSales = SalesTable.selectAll()
      .where { SalesTable.companyId eq companyId }
      .orderBy(SalesTable.createdAt to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toSale() }

    val recentPaymentLogs = SaleLogsTable.selectAll()
      .where { SaleLogsTable.companyId eq companyId }
      .orderBy(SaleLogsTable.paymentDate to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toSaleLog() }

    val recentProducts = ProductsTable.selectAll()
      .where { ProductsTable.companyId eq companyId }
      .orderBy(ProductsTable.createdAt to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toProduct() }

    val recentVendors = VendorsTable.selectAll()
      .where { VendorsTable.companyId eq companyId }
      .orderBy(VendorsTable.createdAt to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toVendor() }

    val recentAccounts = AccountsTable.selectAll()
      .where { AccountsTable.companyId eq companyId }
      .orderBy(AccountsTable.createdAt to SortOrder.DESC)
      .limit(recentLimit)
      .map { it.toAccount() }

    DashboardData(
      year = selectedYear,
      month = selectedMonth,
      counts = DashboardSummaryCounts(
        totalCustomers = totalCustomers,
        totalSales = totalSales,
        totalPaymentLogs = totalPaymentLogs,
        totalProducts = totalProducts,
        totalVendors = totalVendors,
        totalAccounts = totalAccounts,
        selectedPeriodPaymentTotalAmount = selectedPeriodPaymentTotalAmount,
        selectedPeriodPaymentCount = selectedPeriodPaymentCount,
        selectedPeriodSalesTotalAmount = selectedPeriodSalesTotalAmount,
        selectedPeriodSalesCount = selectedPeriodSalesCount
      ),
      recentCustomers = recentCustomers,
      recentSales = recentSales,
      recentPaymentLogs = recentPaymentLogs,
      recentProducts = recentProducts,
      recentVendors = recentVendors,
      recentAccounts = recentAccounts,
      periodSales = periodSales,
      periodPaymentLogs = periodPaymentLogs
    )
  }
}

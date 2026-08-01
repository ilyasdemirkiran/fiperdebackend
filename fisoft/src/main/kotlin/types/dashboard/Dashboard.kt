package com.ilyasdemirkiran.types.dashboard

import com.ilyasdemirkiran.types.accounts.Account
import com.ilyasdemirkiran.types.customers.Customer
import com.ilyasdemirkiran.types.products.Product
import com.ilyasdemirkiran.types.sales.Sale
import com.ilyasdemirkiran.types.sales.SaleLog
import com.ilyasdemirkiran.types.vendors.Vendor
import kotlinx.serialization.Serializable

@Serializable
data class DashboardSummaryCounts(
  val totalCustomers: Long,
  val totalSales: Long,
  val totalPaymentLogs: Long,
  val totalProducts: Long,
  val totalVendors: Long,
  val totalAccounts: Long,
  val selectedPeriodPaymentTotalAmount: Int, // Seçilen ayın kuruş cinsinden toplam tahsilatı
  val selectedPeriodPaymentCount: Long,
  val selectedPeriodSalesTotalAmount: Int, // Seçilen ayın kuruş cinsinden toplam satış tutarı
  val selectedPeriodSalesCount: Long
)

@Serializable
data class DashboardData(
  val year: Int,
  val month: Int,
  val counts: DashboardSummaryCounts,
  val recentCustomers: List<Customer>,
  val recentSales: List<Sale>,
  val recentPaymentLogs: List<SaleLog>,
  val recentProducts: List<Product>,
  val recentVendors: List<Vendor>,
  val recentAccounts: List<Account>,
  val periodSales: List<Sale>,
  val periodPaymentLogs: List<SaleLog>
)

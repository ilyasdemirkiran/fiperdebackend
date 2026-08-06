package com.ilyasdemirkiran.services

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.serialization.Serializable

@Serializable
data class CurrencyRateResponse(
    val TRY: Double = 1.0,
    val USD: Double = 35.0,
    val EUR: Double = 38.0
)

class CurrencyService {
    private val client = HttpClient(CIO)

    suspend fun getCurrencyRates(): CurrencyRateResponse {
        return try {
            val response: HttpResponse = client.get("https://www.tcmb.gov.tr/kurlar/today.xml")
            val xmlText = response.bodyAsText()

            var usd = 35.0
            var eur = 38.0

            // Simple XML parsing for USD ForexBuying / ForexSelling
            val usdMatch = Regex("""<Currency CrossOrder="\d+" CurrencyCode="USD">[\s\S]*?<ForexSelling>([\d.]+)</ForexSelling>""").find(xmlText)
            if (usdMatch != null) {
                usd = usdMatch.groupValues[1].toDoubleOrNull() ?: 35.0
            }

            val eurMatch = Regex("""<Currency CrossOrder="\d+" CurrencyCode="EUR">[\s\S]*?<ForexSelling>([\d.]+)</ForexSelling>""").find(xmlText)
            if (eurMatch != null) {
                eur = eurMatch.groupValues[1].toDoubleOrNull() ?: 38.0
            }

            CurrencyRateResponse(TRY = 1.0, USD = usd, EUR = eur)
        } catch (e: Exception) {
            CurrencyRateResponse(TRY = 1.0, USD = 35.0, EUR = 38.0)
        }
    }
}

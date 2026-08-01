package com.ilyasdemirkiran.services

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.serialization.Serializable
import org.w3c.dom.Element
import javax.xml.parsers.DocumentBuilderFactory

@Serializable
data class ExchangeRate(
  val currency: String, // USD, EUR, TRY
  val name: String,
  val rateInTRY: Double // TL karşılığı satış kuru (TRY için 1.0)
)

object ExchangeRateService {

  private val client = HttpClient(CIO)

  suspend fun getRates(): List<ExchangeRate> {
    val resultList = mutableListOf(
      ExchangeRate(currency = "TRY", name = "Türk Lirası", rateInTRY = 1.0)
    )

    try {
      val responseXml: String = client.get("https://www.tcmb.gov.tr/kurlar/today.xml").bodyAsText()
      val dbFactory = DocumentBuilderFactory.newInstance()
      val dBuilder = dbFactory.newDocumentBuilder()
      val doc = dBuilder.parse(responseXml.byteInputStream())
      doc.documentElement.normalize()

      val nodeList = doc.getElementsByTagName("Currency")

      for (i in 0 until nodeList.length) {
        val node = nodeList.item(i)
        if (node.nodeType == Element.ELEMENT_NODE) {
          val element = node as Element
          val currencyCode = element.getAttribute("CurrencyCode")

          if (currencyCode == "USD" || currencyCode == "EUR") {
            val currencyName = element.getElementsByTagName("Isim").item(0)?.textContent ?: currencyCode
            val forexSellingStr = element.getElementsByTagName("ForexSelling").item(0)?.textContent

            val rate = forexSellingStr?.replace(",", ".")?.toDoubleOrNull() ?: 1.0
            resultList.add(ExchangeRate(currency = currencyCode, name = currencyName, rateInTRY = rate))
          }
        }
      }
    } catch (e: Exception) {
      println("Error fetching TCMB rates: ${e.message}")
      // Fallback default values if TCMB API is unreachable
      if (resultList.none { it.currency == "USD" }) {
        resultList.add(ExchangeRate("USD", "US DOLLAR", 35.0))
      }
      if (resultList.none { it.currency == "EUR" }) {
        resultList.add(ExchangeRate("EUR", "EURO", 38.0))
      }
    }

    return resultList
  }
}

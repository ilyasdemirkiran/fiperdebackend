package com.ilyasdemirkiran.types

import com.google.i18n.phonenumbers.NumberParseException
import com.google.i18n.phonenumbers.PhoneNumberUtil
import kotlinx.serialization.Serializable

@JvmInline
@Serializable
value class PhoneNumber(val value: String)

object PhoneNumbers {

  private val util = PhoneNumberUtil.getInstance()

  @Throws(NumberParseException::class)
  fun parse(phone: String, region: String = "TR"): PhoneNumber {
    val parsed = util.parse(phone, region)

    require(util.isValidNumber(parsed)) {
      "Invalid phone number: $phone"
    }

    return PhoneNumber(
      util.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164)
    )
  }

  fun normalizeToDigits(phone: String): String {
    val digits = phone.filter { it.isDigit() }
    return if (digits.length >= 10) digits.takeLast(10) else digits
  }
}
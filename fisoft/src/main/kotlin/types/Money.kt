package com.ilyasdemirkiran.types

import kotlinx.serialization.Serializable

@Serializable
@JvmInline
value class Money(val amountInCents: Long = 0L) : Comparable<Money> {
    val toDouble: Double get() = amountInCents / 100.0
    val toCents: Long get() = amountInCents

    operator fun plus(other: Money): Money = Money(this.amountInCents + other.amountInCents)
    operator fun minus(other: Money): Money = Money(this.amountInCents - other.amountInCents)
    operator fun times(factor: Double): Money = Money(Math.round(this.amountInCents * factor))
    operator fun times(factor: Int): Money = Money(this.amountInCents * factor)
    operator fun div(divisor: Int): Money = if (divisor == 0) ZERO else Money(this.amountInCents / divisor)
    operator fun div(divisor: Double): Money = if (divisor == 0.0) ZERO else Money(Math.round(this.amountInCents / divisor))

    override fun compareTo(other: Money): Int = this.amountInCents.compareTo(other.amountInCents)

    fun applyDiscountPercent(percent: Double): Money {
        if (percent <= 0.0) return this
        val discountAmount = Math.round(this.amountInCents * (percent / 100.0))
        return Money((this.amountInCents - discountAmount).coerceAtLeast(0L))
    }

    override fun toString(): String = String.format("%.2f", toDouble)

    companion object {
        val ZERO = Money(0L)

        fun fromDouble(amount: Double): Money = Money(Math.round(amount * 100.0))
        fun fromCents(cents: Long): Money = Money(cents)
        fun fromCents(cents: Int): Money = Money(cents.toLong())
    }
}

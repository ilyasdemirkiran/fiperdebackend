package com.ilyasdemirkiran.services

import com.ilyasdemirkiran.middleware.AppError
import com.ilyasdemirkiran.repository.SubscriptionRepository
import com.ilyasdemirkiran.types.Money
import com.ilyasdemirkiran.types.subscription.Subscription
import com.ilyasdemirkiran.types.subscription.SubscriptionInfo
import io.ktor.http.*
import java.time.Instant

class SubscriptionService(
    private val repo: SubscriptionRepository = SubscriptionRepository()
) {
    suspend fun getSubscription(companyId: String): SubscriptionInfo {
        val sub = repo.findByCompanyId(companyId)
        if (sub == null) {
            return SubscriptionInfo(
                status = "active",
                plan = "monthly",
                expiresAt = Instant.now().plusSeconds(30 * 86400).toString()
            )
        }
        return SubscriptionInfo(
            status = sub.status,
            plan = sub.plan,
            expiresAt = sub.subscriptionEndDate
        )
    }

    suspend fun createSubscription(companyId: String, plan: String, oid: String, amount: Money): Subscription {
        val now = Instant.now()
        val endDate = if (plan == "yearly") now.plusSeconds(365 * 86400) else now.plusSeconds(30 * 86400)
        val sub = Subscription(
            companyId = companyId,
            status = "active",
            plan = plan,
            paytrMerchantOid = oid,
            paytrPaymentAmount = amount,
            subscriptionStartDate = now.toString(),
            subscriptionEndDate = endDate.toString(),
            createdAt = now.toString()
        )
        return repo.create(sub)
    }
}

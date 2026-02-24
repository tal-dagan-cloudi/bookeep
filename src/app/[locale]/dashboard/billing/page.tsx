"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { CheckCircle, CreditCard, Zap } from "lucide-react"

type PlanInfo = {
  id: string
  name: string
  priceUsd: number
  priceIls: number
  maxDocumentsPerMonth: number
  maxEmailInboxes: number
  features: string[]
  price: { amount: number; currency: string; formatted: string }
}

type Usage = {
  plan: { id: string; name: string }
  usage: {
    documents: { used: number; limit: number; percentage: number }
    emailInboxes: { used: number; limit: number; percentage: number }
  }
}

export default function BillingPage() {
  const t = useTranslations("billing")
  const locale = useLocale()
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [plansRes, usageRes] = await Promise.all([
        fetch(`/api/billing/plans?locale=${locale}`),
        fetch("/api/billing/usage"),
      ])

      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.plans)
      }
      if (usageRes.ok) {
        const data = await usageRes.json()
        setUsage(data)
      }
    } catch (err) {
      console.error("Failed to fetch billing data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [locale])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Current Usage */}
      {usage && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("currentUsage")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <UsageMeter
              label={t("documentsThisMonth")}
              used={usage.usage.documents.used}
              limit={usage.usage.documents.limit}
              percentage={usage.usage.documents.percentage}
            />
            <UsageMeter
              label={t("emailInboxes")}
              used={usage.usage.emailInboxes.used}
              limit={usage.usage.emailInboxes.limit}
              percentage={usage.usage.emailInboxes.percentage}
            />
          </div>
        </section>
      )}

      {/* Plans */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("plans")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = usage?.plan.id === plan.id
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border p-6 ${
                  isCurrent
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                {isCurrent && (
                  <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <CheckCircle className="h-3 w-3" />
                    {t("currentPlan")}
                  </span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {plan.price.formatted}
                  </span>
                  {plan.price.amount > 0 && (
                    <span className="text-sm text-muted-foreground">
                      /{t("month")}
                    </span>
                  )}
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {!isCurrent && plan.price.amount > 0 && (
                  <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Zap className="h-4 w-4" />
                    {t("upgrade")}
                  </button>
                )}
                {!isCurrent && plan.price.amount === 0 && (
                  <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                    {t("downgrade")}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function UsageMeter({
  label,
  used,
  limit,
  percentage,
}: {
  label: string
  used: number
  limit: number
  percentage: number
}) {
  const isUnlimited = limit === -1
  const isWarning = !isUnlimited && percentage >= 80
  const isDanger = !isUnlimited && percentage >= 100

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <span className="text-sm text-muted-foreground">
          {used} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              isDanger
                ? "bg-red-500"
                : isWarning
                  ? "bg-yellow-500"
                  : "bg-primary"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

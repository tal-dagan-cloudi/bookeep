import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { organizations } from "@/server/db/schema"

export type PlanId = "free" | "business" | "accountant"

export type PlanConfig = {
  id: PlanId
  name: string
  priceUsd: number
  priceIls: number
  maxDocumentsPerMonth: number
  maxEmailInboxes: number
  features: string[]
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    priceIls: 0,
    maxDocumentsPerMonth: 20,
    maxEmailInboxes: 1,
    features: [
      "1 email inbox",
      "20 documents/month",
      "CSV export",
      "AI extraction",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceUsd: 49,
    priceIls: 219,
    maxDocumentsPerMonth: -1, // unlimited
    maxEmailInboxes: -1,
    features: [
      "Unlimited email inboxes",
      "Unlimited documents",
      "All export formats",
      "Accounting integrations",
      "Automation rules",
      "WhatsApp scanner",
      "API access",
    ],
  },
  accountant: {
    id: "accountant",
    name: "Accountant",
    priceUsd: 99,
    priceIls: 449,
    maxDocumentsPerMonth: -1,
    maxEmailInboxes: -1,
    features: [
      "Everything in Business",
      "Unlimited client management",
      "Multi-entity dashboard",
      "Priority support",
      "Custom branding",
    ],
  },
}

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId as PlanId] || PLANS.free
}

export function getPriceForLocale(
  plan: PlanConfig,
  locale: string
): { amount: number; currency: string; formatted: string } {
  if (locale === "he") {
    return {
      amount: plan.priceIls,
      currency: "ILS",
      formatted: plan.priceIls === 0 ? "חינם" : `₪${plan.priceIls}`,
    }
  }
  return {
    amount: plan.priceUsd,
    currency: "USD",
    formatted: plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`,
  }
}

export async function checkPlanLimits(
  orgId: string,
  resource: "documents" | "emailInboxes",
  currentCount: number
): Promise<{ allowed: boolean; limit: number; used: number }> {
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const plan = getPlan(org?.plan || "free")

  const limit =
    resource === "documents"
      ? plan.maxDocumentsPerMonth
      : plan.maxEmailInboxes

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, used: currentCount }
  }

  return {
    allowed: currentCount < limit,
    limit,
    used: currentCount,
  }
}

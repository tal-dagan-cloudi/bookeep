import { NextResponse } from "next/server"
import { and, eq, gte, sql } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { getPlan } from "@/lib/billing"
import { db } from "@/server/db"
import { documents, emailAccounts } from "@/server/db/schema"

export async function GET() {
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { orgId, plan: planId } = authResult.context
  const plan = getPlan(planId)

  // Count documents this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [docCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        gte(documents.createdAt, startOfMonth)
      )
    )

  // Count email inboxes
  const [emailCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailAccounts)
    .where(eq(emailAccounts.orgId, orgId))

  const documentsUsed = Number(docCount.count)
  const emailsUsed = Number(emailCount.count)

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
    },
    usage: {
      documents: {
        used: documentsUsed,
        limit: plan.maxDocumentsPerMonth,
        percentage:
          plan.maxDocumentsPerMonth === -1
            ? 0
            : Math.round(
                (documentsUsed / plan.maxDocumentsPerMonth) * 100
              ),
      },
      emailInboxes: {
        used: emailsUsed,
        limit: plan.maxEmailInboxes,
        percentage:
          plan.maxEmailInboxes === -1
            ? 0
            : Math.round((emailsUsed / plan.maxEmailInboxes) * 100),
      },
    },
  })
}

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { and, eq, gte, sql } from "drizzle-orm"

import { getPlan } from "@/lib/billing"
import { db } from "@/server/db"
import {
  documents,
  emailAccounts,
  organizations,
  orgMembers,
  users,
} from "@/server/db/schema"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1)

  const orgId = membership ? membership.orgId : user.id

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const plan = getPlan(org?.plan || "free")

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

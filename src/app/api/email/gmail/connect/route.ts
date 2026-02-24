import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { checkPlanLimits } from "@/lib/billing"
import { getGmailAuthUrl } from "@/lib/gmail"
import { db } from "@/server/db"
import { emailAccounts } from "@/server/db/schema"

export async function GET() {
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { dbUserId, orgId } = authResult.context

  // Check plan limits for email inboxes
  const [emailCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailAccounts)
    .where(eq(emailAccounts.orgId, orgId))

  const planCheck = await checkPlanLimits(
    orgId,
    "emailInboxes",
    Number(emailCount.count)
  )

  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: "Email inbox limit reached for your plan",
        limit: planCheck.limit,
        used: planCheck.used,
      },
      { status: 403 }
    )
  }

  const state = Buffer.from(
    JSON.stringify({ userId: dbUserId })
  ).toString("base64url")

  const authUrl = getGmailAuthUrl(state)

  return NextResponse.redirect(authUrl)
}

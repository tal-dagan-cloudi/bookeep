import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { db } from "@/server/db"
import { emailAccounts } from "@/server/db/schema"

export async function GET() {
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { orgId } = authResult.context

  const accounts = await db
    .select({
      id: emailAccounts.id,
      provider: emailAccounts.provider,
      emailAddress: emailAccounts.emailAddress,
      syncStatus: emailAccounts.syncStatus,
      lastSyncAt: emailAccounts.lastSyncAt,
      createdAt: emailAccounts.createdAt,
    })
    .from(emailAccounts)
    .where(eq(emailAccounts.orgId, orgId))

  return NextResponse.json({ accounts })
}

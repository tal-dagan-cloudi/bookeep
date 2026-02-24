import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { emailAccounts, users } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params
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

  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, id))
    .limit(1)

  if (!account) {
    return NextResponse.json(
      { error: "Email account not found" },
      { status: 404 }
    )
  }

  await db.delete(emailAccounts).where(eq(emailAccounts.id, id))

  return NextResponse.json({ success: true })
}

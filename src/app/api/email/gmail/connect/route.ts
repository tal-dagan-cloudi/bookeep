import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { getGmailAuthUrl } from "@/lib/gmail"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

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

  const state = Buffer.from(
    JSON.stringify({ userId: user.id })
  ).toString("base64url")

  const authUrl = getGmailAuthUrl(state)

  return NextResponse.redirect(authUrl)
}

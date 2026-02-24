import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { users, orgMembers, organizations } from "@/server/db/schema"

export type AuthContext = {
  userId: string
  dbUserId: string
  orgId: string
  plan: string
}

export async function getAuthContext(): Promise<
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      ),
    }
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

  return {
    success: true,
    context: {
      userId,
      dbUserId: user.id,
      orgId,
      plan: org?.plan || "free",
    },
  }
}

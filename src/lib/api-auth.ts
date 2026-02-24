import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
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

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  // Auto-provision user if authenticated via Clerk but missing from DB
  if (!user) {
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        ),
      }
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")

    const [created] = await db
      .insert(users)
      .values({
        clerkId: userId,
        email,
        name: name || null,
        avatarUrl: clerkUser.imageUrl || null,
      })
      .onConflictDoNothing()
      .returning()

    if (created) {
      user = created
    } else {
      // Race condition: another request created it
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1)
      if (!existing) {
        return {
          success: false,
          response: NextResponse.json(
            { error: "User provisioning failed" },
            { status: 500 }
          ),
        }
      }
      user = existing
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

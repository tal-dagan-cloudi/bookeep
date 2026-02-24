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

  // Find org membership
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1)

  let orgId: string

  if (membership) {
    orgId = membership.orgId
  } else {
    // Check if a personal org already exists for this user
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, user.id))
      .limit(1)

    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      // Auto-create a personal organization
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: user.name || user.email || "My Organization",
          slug: `personal-${user.id.slice(0, 8)}`,
          ownerId: user.id,
          plan: "free",
        })
        .returning()

      orgId = newOrg.id

      // Add user as admin member
      await db.insert(orgMembers).values({
        orgId: newOrg.id,
        userId: user.id,
        role: "admin",
        joinedAt: new Date(),
      })
    }
  }

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

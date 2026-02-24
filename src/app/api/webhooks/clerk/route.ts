import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { Webhook } from "svix"
import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { organizations, orgMembers, users } from "@/server/db/schema"

type WebhookEvent = {
  type: string
  data: Record<string, unknown>
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    )
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get("svix-id")
  const svixTimestamp = headerPayload.get("svix-timestamp")
  const svixSignature = headerPayload.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    )
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    )
  }

  const { type, data } = event

  switch (type) {
    case "user.created":
    case "user.updated": {
      const clerkId = data.id as string
      const email =
        (
          data.email_addresses as Array<{
            email_address: string
            id: string
          }>
        )?.find(
          (e) => e.id === (data.primary_email_address_id as string)
        )?.email_address ?? ""
      const name = [data.first_name, data.last_name]
        .filter(Boolean)
        .join(" ")
      const avatarUrl = data.image_url as string | null

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(users)
          .set({
            email,
            name: name || null,
            avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId))
      } else {
        await db.insert(users).values({
          clerkId,
          email,
          name: name || null,
          avatarUrl,
        })
      }
      break
    }

    case "user.deleted": {
      const clerkId = data.id as string
      await db.delete(users).where(eq(users.clerkId, clerkId))
      break
    }

    case "organization.created": {
      const orgData = data
      const clerkOrgId = orgData.id as string
      const name = orgData.name as string
      const slug = orgData.slug as string
      const createdByClerkId = orgData.created_by as string

      const owner = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, createdByClerkId))
        .limit(1)

      if (owner.length > 0) {
        await db.insert(organizations).values({
          name,
          slug: slug || clerkOrgId,
          ownerId: owner[0].id,
        })
      }
      break
    }

    case "organizationMembership.created": {
      const membership = data
      const orgSlug = (
        membership.organization as { slug: string }
      )?.slug
      const memberClerkId = (
        membership.public_user_data as { user_id: string }
      )?.user_id
      const role = (membership.role as string) || "member"

      if (orgSlug && memberClerkId) {
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, orgSlug))
          .limit(1)

        const user = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, memberClerkId))
          .limit(1)

        if (org.length > 0 && user.length > 0) {
          const mappedRole = role.includes("admin")
            ? ("admin" as const)
            : ("member" as const)

          await db.insert(orgMembers).values({
            orgId: org[0].id,
            userId: user[0].id,
            role: mappedRole,
            joinedAt: new Date(),
          })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

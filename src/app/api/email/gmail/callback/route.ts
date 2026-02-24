import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { exchangeGmailCode } from "@/lib/gmail"
import { encrypt } from "@/lib/encryption"
import { scheduleEmailScan } from "@/lib/queue"
import { db } from "@/server/db"
import { emailAccounts, orgMembers, users } from "@/server/db/schema"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(
      new URL("/auth/sign-in", req.nextUrl.origin)
    )
  }

  const code = req.nextUrl.searchParams.get("code")
  const stateParam = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations?error=${encodeURIComponent(error)}`,
        req.nextUrl.origin
      )
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations?error=missing_params",
        req.nextUrl.origin
      )
    )
  }

  try {
    const state = JSON.parse(
      Buffer.from(stateParam, "base64url").toString()
    ) as { userId: string }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user || user.id !== state.userId) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/integrations?error=invalid_state",
          req.nextUrl.origin
        )
      )
    }

    const tokens = await exchangeGmailCode(code)

    // Get user's org
    const [membership] = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, user.id))
      .limit(1)

    const orgId = membership ? membership.orgId : user.id

    // Get Gmail email address from tokens
    const { google } = await import("googleapis")
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials(tokens)
    const gmail = google.gmail({ version: "v1", auth: oauth2Client })
    const profile = await gmail.users.getProfile({ userId: "me" })
    const emailAddress = profile.data.emailAddress || "unknown"

    // Store the email account
    const [emailAccount] = await db
      .insert(emailAccounts)
      .values({
        orgId,
        userId: user.id,
        provider: "gmail",
        emailAddress,
        oauthTokenEncrypted: encrypt(tokens.access_token!),
        refreshTokenEncrypted: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : null,
        syncStatus: "idle",
      })
      .returning()

    // Schedule initial full scan
    await scheduleEmailScan(emailAccount.id, "full")

    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations?success=gmail_connected",
        req.nextUrl.origin
      )
    )
  } catch (err) {
    console.error("Gmail callback error:", err)
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations?error=connection_failed",
        req.nextUrl.origin
      )
    )
  }
}

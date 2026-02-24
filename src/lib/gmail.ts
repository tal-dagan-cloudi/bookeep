import { google } from "googleapis"

import { decrypt, encrypt } from "./encryption"
import { db } from "@/server/db"
import { emailAccounts } from "@/server/db/schema"
import { eq } from "drizzle-orm"

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
  )
}

export function getGmailAuthUrl(state: string): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  })
}

export async function exchangeGmailCode(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getGmailClient(emailAccountId: string) {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, emailAccountId))
    .limit(1)

  if (!account) {
    throw new Error("Email account not found")
  }

  const accessToken = account.oauthTokenEncrypted
    ? decrypt(account.oauthTokenEncrypted)
    : undefined
  const refreshToken = account.refreshTokenEncrypted
    ? decrypt(account.refreshTokenEncrypted)
    : undefined

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  // Handle token refresh
  client.on("tokens", async (newTokens) => {
    const updates: Partial<{
      oauthTokenEncrypted: string
      refreshTokenEncrypted: string
    }> = {}
    if (newTokens.access_token) {
      updates.oauthTokenEncrypted = encrypt(newTokens.access_token)
    }
    if (newTokens.refresh_token) {
      updates.refreshTokenEncrypted = encrypt(newTokens.refresh_token)
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(emailAccounts)
        .set(updates)
        .where(eq(emailAccounts.id, emailAccountId))
    }
  })

  return google.gmail({ version: "v1", auth: client })
}

// Receipt detection keywords
const RECEIPT_KEYWORDS = [
  "receipt",
  "invoice",
  "order confirmation",
  "payment confirmation",
  "purchase",
  "billing",
  "transaction",
  "payment received",
  "your order",
  "order summary",
  // Hebrew
  "קבלה",
  "חשבונית",
  "אישור הזמנה",
  "אישור תשלום",
  "סיכום הזמנה",
]

const RECEIPT_SENDERS = [
  "amazon",
  "paypal",
  "stripe",
  "square",
  "shopify",
  "uber",
  "lyft",
  "doordash",
  "grubhub",
  "airbnb",
  "booking.com",
  "apple",
  "google",
  "microsoft",
  "dropbox",
  "spotify",
  "netflix",
  "wix",
  "gett",
  "wolt",
  "yango",
]

export function isLikelyReceipt(
  subject: string,
  from: string,
  hasAttachments: boolean
): boolean {
  const subjectLower = subject.toLowerCase()
  const fromLower = from.toLowerCase()

  // Check subject keywords
  const subjectMatch = RECEIPT_KEYWORDS.some((kw) =>
    subjectLower.includes(kw.toLowerCase())
  )

  // Check known receipt senders
  const senderMatch = RECEIPT_SENDERS.some((s) => fromLower.includes(s))

  // PDF/image attachment is a strong signal
  if (hasAttachments && (subjectMatch || senderMatch)) {
    return true
  }

  // Subject match alone is enough
  if (subjectMatch) {
    return true
  }

  // Known sender alone is enough
  if (senderMatch) {
    return true
  }

  return false
}

export type GmailMessage = {
  messageId: string
  subject: string
  from: string
  date: string
  hasAttachments: boolean
  attachments: Array<{
    attachmentId: string
    filename: string
    mimeType: string
    size: number
  }>
}

export async function fetchGmailMessages(
  emailAccountId: string,
  options: {
    maxResults?: number
    afterDate?: string // RFC 3339
    pageToken?: string
  } = {}
): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
  const gmail = await getGmailClient(emailAccountId)

  let query = "has:attachment OR subject:(receipt OR invoice OR קבלה OR חשבונית)"
  if (options.afterDate) {
    query += ` after:${options.afterDate}`
  }

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: options.maxResults || 50,
    pageToken: options.pageToken,
  })

  const messageIds = listResponse.data.messages || []
  const results: GmailMessage[] = []

  for (const msg of messageIds) {
    if (!msg.id) continue

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    })

    const headers = detail.data.payload?.headers || []
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "(no subject)"
    const from = headers.find((h) => h.name === "From")?.value || ""
    const date = headers.find((h) => h.name === "Date")?.value || ""

    const parts = detail.data.payload?.parts || []
    const attachments = parts
      .filter(
        (p) =>
          p.filename &&
          p.body?.attachmentId &&
          (p.mimeType?.startsWith("image/") ||
            p.mimeType === "application/pdf")
      )
      .map((p) => ({
        attachmentId: p.body!.attachmentId!,
        filename: p.filename!,
        mimeType: p.mimeType!,
        size: p.body?.size || 0,
      }))

    results.push({
      messageId: msg.id,
      subject,
      from,
      date,
      hasAttachments: attachments.length > 0,
      attachments,
    })
  }

  return {
    messages: results,
    nextPageToken: listResponse.data.nextPageToken || undefined,
  }
}

export async function downloadGmailAttachment(
  emailAccountId: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const gmail = await getGmailClient(emailAccountId)

  const response = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  })

  const data = response.data.data
  if (!data) {
    throw new Error("No attachment data")
  }

  return Buffer.from(data, "base64")
}

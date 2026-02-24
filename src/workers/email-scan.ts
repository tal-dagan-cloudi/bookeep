import { eq } from "drizzle-orm"

import {
  downloadGmailAttachment,
  fetchGmailMessages,
  isLikelyReceipt,
} from "@/lib/gmail"
import { scheduleDocumentProcess } from "@/lib/queue"
import { saveFile, generateThumbnail } from "@/lib/storage"
import { db } from "@/server/db"
import { documents, emailAccounts } from "@/server/db/schema"
import {
  createEmailScanWorker,
  type EmailScanJobData,
} from "@/lib/queue"
import type { Job } from "bullmq"

async function processEmailScan(job: Job<EmailScanJobData>) {
  const { emailAccountId, mode } = job.data

  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, emailAccountId))
    .limit(1)

  if (!account) {
    throw new Error(`Email account ${emailAccountId} not found`)
  }

  // Update sync status
  await db
    .update(emailAccounts)
    .set({ syncStatus: "syncing", lastSyncAt: new Date() })
    .where(eq(emailAccounts.id, emailAccountId))

  try {
    const afterDate =
      mode === "full"
        ? getDateMonthsAgo(12)
        : account.lastSyncAt
          ? formatDate(account.lastSyncAt)
          : getDateMonthsAgo(1)

    let pageToken: string | undefined
    let totalProcessed = 0
    let totalReceipts = 0

    do {
      const { messages, nextPageToken } = await fetchGmailMessages(
        emailAccountId,
        {
          maxResults: 50,
          afterDate,
          pageToken,
        }
      )

      for (const msg of messages) {
        totalProcessed++

        if (!isLikelyReceipt(msg.subject, msg.from, msg.hasAttachments)) {
          continue
        }

        // Process attachments
        for (const attachment of msg.attachments) {
          // Check for duplicates (by messageId + attachmentId)
          const existing = await db
            .select({ id: documents.id })
            .from(documents)
            .where(eq(documents.sourceRef, `gmail:${msg.messageId}:${attachment.attachmentId}`))
            .limit(1)

          if (existing.length > 0) continue

          const buffer = await downloadGmailAttachment(
            emailAccountId,
            msg.messageId,
            attachment.attachmentId
          )

          const { filePath, fileType, fileSizeBytes } = await saveFile(
            buffer,
            attachment.filename,
            account.orgId
          )

          let thumbnailUrl: string | null = null
          try {
            thumbnailUrl = await generateThumbnail(filePath, account.orgId)
          } catch {
            // Non-critical
          }

          const [doc] = await db
            .insert(documents)
            .values({
              orgId: account.orgId,
              source: "email",
              sourceRef: `gmail:${msg.messageId}:${attachment.attachmentId}`,
              status: "pending",
              fileUrl: filePath,
              fileType,
              fileSizeBytes,
              thumbnailUrl,
            })
            .returning()

          // Queue for AI extraction
          await scheduleDocumentProcess(doc.id)
          totalReceipts++
        }
      }

      pageToken = nextPageToken

      // Update job progress
      await job.updateProgress({
        processed: totalProcessed,
        receipts: totalReceipts,
      })

      // Rate limit: small delay between pages
      await sleep(500)
    } while (pageToken)

    // Update sync status
    await db
      .update(emailAccounts)
      .set({
        syncStatus: "idle",
        lastSyncAt: new Date(),
      })
      .where(eq(emailAccounts.id, emailAccountId))
  } catch (error) {
    await db
      .update(emailAccounts)
      .set({ syncStatus: "error" })
      .where(eq(emailAccounts.id, emailAccountId))
    throw error
  }
}

function getDateMonthsAgo(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return formatDate(date)
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Start the worker
export const emailScanWorker = createEmailScanWorker(processEmailScan)

emailScanWorker.on("completed", (job) => {
  console.info(`Email scan completed: ${job.id}`)
})

emailScanWorker.on("failed", (job, err) => {
  console.error(`Email scan failed: ${job?.id}`, err)
})

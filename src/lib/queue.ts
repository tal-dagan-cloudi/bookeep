import { Queue, Worker, type Job } from "bullmq"

import { getRedis } from "./redis"

const connection = { connection: getRedis() }

// Queues
export const emailScanQueue = new Queue("email-scan", connection)
export const documentProcessQueue = new Queue("document-process", connection)

// Types
export type EmailScanJobData = {
  emailAccountId: string
  mode: "full" | "incremental"
}

export type DocumentProcessJobData = {
  documentId: string
}

// Helper to add email scan job
export async function scheduleEmailScan(
  emailAccountId: string,
  mode: "full" | "incremental" = "incremental"
) {
  return emailScanQueue.add(
    "scan",
    { emailAccountId, mode } satisfies EmailScanJobData,
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  )
}

// Helper to add document processing job
export async function scheduleDocumentProcess(documentId: string) {
  return documentProcessQueue.add(
    "process",
    { documentId } satisfies DocumentProcessJobData,
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  )
}

// Create worker factory
export function createEmailScanWorker(
  handler: (job: Job<EmailScanJobData>) => Promise<void>
) {
  return new Worker<EmailScanJobData>("email-scan", handler, {
    ...connection,
    concurrency: 2,
    limiter: { max: 10, duration: 60000 },
  })
}

export function createDocumentProcessWorker(
  handler: (job: Job<DocumentProcessJobData>) => Promise<void>
) {
  return new Worker<DocumentProcessJobData>("document-process", handler, {
    ...connection,
    concurrency: 5,
  })
}

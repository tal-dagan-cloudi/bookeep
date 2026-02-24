import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { saveFile, generateThumbnail } from "@/lib/storage"
import { scheduleDocumentProcess } from "@/lib/queue"
import { db } from "@/server/db"
import { documents, organizations } from "@/server/db/schema"

// Twilio WhatsApp webhook handler
// Receives incoming WhatsApp messages with receipt photos

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const from = formData.get("From") as string // e.g., "whatsapp:+972501234567"
  const body = formData.get("Body") as string
  const numMedia = parseInt((formData.get("NumMedia") as string) || "0", 10)

  if (!from) {
    return NextResponse.json({ error: "Missing From" }, { status: 400 })
  }

  // Extract phone number
  const phoneNumber = from.replace("whatsapp:", "")

  // Find org linked to this WhatsApp number
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.whatsappNumber, phoneNumber))
    .limit(1)

  if (!org) {
    // Reply with setup instructions
    return createTwimlResponse(
      "Welcome to Bookeep! Please link your WhatsApp number in the Bookeep dashboard settings first. / ברוכים הבאים לבוקיפ! אנא קשרו את מספר הוואטסאפ שלכם בהגדרות."
    )
  }

  if (numMedia === 0) {
    return createTwimlResponse(
      "Please send a photo of your receipt or invoice. / אנא שלחו תמונה של הקבלה או החשבונית."
    )
  }

  const results: string[] = []

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = formData.get(`MediaUrl${i}`) as string
    const mediaType = formData.get(`MediaContentType${i}`) as string

    if (!mediaUrl || !mediaType) continue

    // Only process images and PDFs
    if (!mediaType.startsWith("image/") && mediaType !== "application/pdf") {
      continue
    }

    try {
      // Download media from Twilio
      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64")}`,
        },
      })

      if (!mediaResponse.ok) continue

      const buffer = Buffer.from(await mediaResponse.arrayBuffer())
      const ext = mediaType.includes("pdf") ? "pdf" : "jpg"
      const filename = `whatsapp_${Date.now()}_${i}.${ext}`

      const { filePath, fileType, fileSizeBytes } = await saveFile(
        buffer,
        filename,
        org.id
      )

      let thumbnailUrl: string | null = null
      try {
        thumbnailUrl = await generateThumbnail(filePath, org.id)
      } catch {
        // Non-critical
      }

      const [doc] = await db
        .insert(documents)
        .values({
          orgId: org.id,
          source: "whatsapp",
          sourceRef: `whatsapp:${phoneNumber}:${Date.now()}:${i}`,
          status: "pending",
          fileUrl: filePath,
          fileType,
          fileSizeBytes,
          thumbnailUrl,
        })
        .returning()

      // Queue for AI extraction
      await scheduleDocumentProcess(doc.id)
      results.push(doc.id)
    } catch (error) {
      console.error("WhatsApp media processing error:", error)
    }
  }

  if (results.length > 0) {
    return createTwimlResponse(
      `Got it! Processing ${results.length} document(s). You'll see them in your dashboard shortly. / קיבלנו! מעבדים ${results.length} מסמך(ים). תוכלו לראות אותם בלוח הבקרה בקרוב.`
    )
  }

  return createTwimlResponse(
    "Could not process the media. Please try again with a clear photo. / לא הצלחנו לעבד את הקובץ. נסו שוב עם תמונה ברורה."
  )
}

// Twilio webhook verification (GET)
export async function GET(req: NextRequest) {
  // Twilio sends GET for webhook verification
  return NextResponse.json({ status: "ok" })
}

function createTwimlResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

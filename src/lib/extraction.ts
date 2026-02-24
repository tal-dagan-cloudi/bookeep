import Anthropic from "@anthropic-ai/sdk"
import { readFile } from "fs/promises"
import path from "path"

const STORAGE_DIR = path.join(process.cwd(), "storage")

type LineItem = {
  description: string
  quantity: number
  unitPrice: number
  total: number
  tax: number
}

export type ExtractionResult = {
  vendorName: string | null
  vendorAddress: string | null
  documentDate: string | null
  documentType:
    | "receipt"
    | "invoice"
    | "bill"
    | "purchase_order"
    | "credit_note"
    | "other"
  documentNumber: string | null
  totalAmount: number | null
  totalTax: number | null
  currency: string
  lineItems: LineItem[]
  rawOcrText: string
  confidenceScore: number
}

const EXTRACTION_PROMPT = `You are an expert document data extractor. Analyze this receipt/invoice image and extract the following structured data.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "vendorName": "string or null",
  "vendorAddress": "string or null",
  "documentDate": "YYYY-MM-DD or null",
  "documentType": "receipt|invoice|bill|purchase_order|credit_note|other",
  "documentNumber": "string or null",
  "totalAmount": number or null,
  "totalTax": number or null,
  "currency": "USD|EUR|ILS|GBP|etc",
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "total": number,
      "tax": number
    }
  ],
  "rawOcrText": "full text content of the document",
  "confidenceScore": 0.0 to 1.0
}

Rules:
- Extract ALL line items if visible
- Use ISO currency codes
- Dates in YYYY-MM-DD format
- If a field is not visible, use null
- Confidence score reflects how certain you are about the extraction accuracy
- For Hebrew documents, translate vendor names to their original Hebrew
- Always include rawOcrText with the full text content`

export async function extractDocument(
  fileRelativePath: string,
  fileType: string
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured")
  }

  const client = new Anthropic({ apiKey })
  const fullPath = path.join(STORAGE_DIR, fileRelativePath)
  const fileBuffer = await readFile(fullPath)
  const base64 = fileBuffer.toString("base64")

  const mediaType = getMediaType(fileType)

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === "text")
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude")
  }

  const parsed = JSON.parse(textContent.text) as ExtractionResult
  return parsed
}

function getMediaType(
  fileType: string
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const typeMap: Record<
    string,
    "image/jpeg" | "image/png" | "image/webp" | "image/gif"
  > = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }
  return typeMap[fileType] || "image/jpeg"
}

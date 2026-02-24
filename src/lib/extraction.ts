import { createWorker } from "tesseract.js"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import sharp from "sharp"
import os from "os"

const STORAGE_DIR = path.join(process.cwd(), "storage")

const MINIMAX_BASE_URL = "https://api.minimax.io/v1"
const MINIMAX_MODEL = "MiniMax-M2.5"

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

const EXTRACTION_PROMPT = `You are an expert receipt and invoice data extractor. Analyze the following OCR text and extract structured data.

IMPORTANT: Return ONLY a valid JSON object. No markdown, no explanation, no thinking.

JSON structure:
{
  "vendorName": "string or null",
  "vendorAddress": "string or null",
  "documentDate": "YYYY-MM-DD or null",
  "documentType": "receipt|invoice|bill|purchase_order|credit_note|other",
  "documentNumber": "string or null",
  "totalAmount": number or null,
  "totalTax": number or null,
  "currency": "ILS|USD|EUR|GBP",
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number, "total": number, "tax": number}],
  "confidenceScore": 0.0 to 1.0
}

CRITICAL RULES for totalAmount:
- totalAmount is the FINAL TOTAL the customer paid — the LARGEST total on the receipt
- In Hebrew receipts, look for: סה"כ לתשלום, סה"כ, סכום כולל, סך הכל — these indicate the final total
- The total is usually the last and largest number, often near the bottom of the receipt
- Do NOT confuse subtotals, tax amounts, or individual item prices with the total
- If you see "סה"כ כולל מע"מ" or "סה"כ לתשלום" followed by a number, THAT is the totalAmount
- If currency symbol ₪ or the word "ש"ח" appears, currency is "ILS"

General rules:
- Extract ALL line items visible in the text
- Dates in YYYY-MM-DD format
- If a field is unclear, use null
- For Hebrew documents, keep vendor names in Hebrew
- Common Hebrew terms: סה"כ (total), מע"מ (VAT), חשבונית (invoice), קבלה (receipt), פריט (item)`

async function preprocessImage(filePath: string): Promise<string> {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `bookeep-ocr-${Date.now()}.png`)

  await sharp(filePath)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .modulate({ brightness: 1.1 })
    .threshold(140)
    .resize({ width: 2400, withoutEnlargement: true })
    .png()
    .toFile(tmpFile)

  return tmpFile
}

async function ocrImage(filePath: string): Promise<string> {
  let processedPath: string | null = null

  try {
    processedPath = await preprocessImage(filePath)

    const worker = await createWorker(["eng", "heb"])
    const result = await worker.recognize(processedPath)
    const text = result.data.text
    await worker.terminate()

    // If preprocessed OCR is too short, try original image
    if (text.trim().length < 10) {
      const worker2 = await createWorker(["eng", "heb"])
      const result2 = await worker2.recognize(filePath)
      const text2 = result2.data.text
      await worker2.terminate()
      return text2
    }

    return text
  } finally {
    if (processedPath) {
      await writeFile(processedPath, "").catch(() => {})
      const { unlink } = await import("fs/promises")
      await unlink(processedPath).catch(() => {})
    }
  }
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const buffer = await readFile(filePath)
  const parser = new PDFParse({ data: buffer })
  const textResult = await parser.getText()
  await parser.destroy()
  return textResult.text
}

async function extractTextFromFile(
  fileRelativePath: string,
  fileType: string
): Promise<string> {
  const fullPath = path.join(STORAGE_DIR, fileRelativePath)

  if (fileType === "pdf") {
    const text = await extractTextFromPdf(fullPath)
    // If PDF has very little text, it might be a scanned PDF — try OCR
    if (text.trim().length < 20) {
      return ocrImage(fullPath)
    }
    return text
  }

  // Image files — use OCR
  return ocrImage(fullPath)
}

function parseMiniMaxResponse(content: string): Omit<ExtractionResult, "rawOcrText"> {
  // Strip <think>...</think> tags (MiniMax chain-of-thought)
  // Strip markdown code fences if present
  const jsonStr = content
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^```json?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()

  // Extract JSON object from response if surrounded by other text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("No JSON object found in MiniMax response")
  }

  return JSON.parse(jsonMatch[0]) as Omit<ExtractionResult, "rawOcrText">
}

async function callMiniMaxVision(
  filePath: string,
  ocrText: string
): Promise<ExtractionResult> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY not configured")
  }

  const imageBuffer = await readFile(filePath)
  const base64Image = imageBuffer.toString("base64")
  const ext = path.extname(filePath).toLowerCase().replace(".", "")
  const mimeType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"

  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a precise document data extractor. You only output valid JSON, nothing else.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}\n\nLook at this receipt/invoice image directly. Read ALL text carefully — especially numbers and Hebrew text. If OCR text is also provided below, use it as a secondary reference, but trust the image more.\n\n--- OCR TEXT (secondary reference) ---\n${ocrText}\n--- END ---`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `MiniMax Vision API error (${response.status}): ${errorBody}`
    )
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("No content in MiniMax Vision response")
  }

  const parsed = parseMiniMaxResponse(content)
  return { ...parsed, rawOcrText: ocrText }
}

async function callMiniMaxText(ocrText: string): Promise<ExtractionResult> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY not configured")
  }

  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a precise document data extractor. You only output valid JSON, nothing else.",
        },
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\n--- OCR TEXT START ---\n${ocrText}\n--- OCR TEXT END ---`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `MiniMax API error (${response.status}): ${errorBody}`
    )
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("No content in MiniMax response")
  }

  const parsed = parseMiniMaxResponse(content)
  return { ...parsed, rawOcrText: ocrText }
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "bmp", "tiff"])

export async function extractDocument(
  fileRelativePath: string,
  fileType: string
): Promise<ExtractionResult> {
  const fullPath = path.join(STORAGE_DIR, fileRelativePath)
  const isImage = IMAGE_EXTENSIONS.has(fileType.toLowerCase())

  // For images: use vision API (primary) with OCR as supplementary context
  if (isImage) {
    const ocrText = await ocrImage(fullPath)

    try {
      return await callMiniMaxVision(fullPath, ocrText)
    } catch (err) {
      console.error("Vision extraction failed, falling back to text-only:", err)
      if (ocrText.trim().length > 0) {
        return callMiniMaxText(ocrText)
      }
    }
  }

  // For PDFs: extract text first, then use text-only API
  const ocrText = await extractTextFromFile(fileRelativePath, fileType)

  if (ocrText.trim().length === 0) {
    return {
      vendorName: null,
      vendorAddress: null,
      documentDate: null,
      documentType: "other",
      documentNumber: null,
      totalAmount: null,
      totalTax: null,
      currency: "USD",
      lineItems: [],
      rawOcrText: "",
      confidenceScore: 0,
    }
  }

  return callMiniMaxText(ocrText)
}

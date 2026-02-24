import { createWorker } from "tesseract.js"
import { readFile, unlink } from "fs/promises"
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
- totalAmount is the number that appears NEXT TO a total indicator keyword — NOT the largest number on the receipt
- OCR often misreads numbers (e.g. "20.0" becomes "200", "59.0" becomes "590") — be aware of this
- Hebrew total indicators (HIGHEST PRIORITY): סה"כ, סה''כ, סה"ע, סה''ע, סך הכל, סה"כ לתשלום, סה"כ כולל מע"מ, סכום כולל
- The number IMMEDIATELY after/near these Hebrew keywords IS the totalAmount
- If you see סה"כ or סה"ע followed by a number like 79.0, the totalAmount is 79.0 — even if larger numbers appear elsewhere
- DO NOT pick the largest number — OCR errors can create artificially large numbers
- Verify: totalAmount should equal the sum of all line item totals (approximately)
- If currency symbol ₪ or the word "ש"ח" appears, currency is "ILS"

RULES for line items:
- Look for item names followed by quantities and prices
- Common OCR errors: decimal points disappear (20.0 → 200), digits merge
- If an item price seems 10x too high compared to a reasonable restaurant/store price, it's likely an OCR error — divide by 10
- Cross-check: sum of line items should approximately match the total near סה"כ/סה"ע

RULES for tax (VAT / מע"מ):
- Look for מע"מ or VAT followed by a number or percentage
- Israeli VAT is typically 17% or 18% — use this to sanity-check
- totalTax is the tax AMOUNT, not the percentage

General rules:
- Extract ALL line items visible in the text
- Dates in YYYY-MM-DD format
- If a field is unclear, use null
- For Hebrew documents, keep vendor names in Hebrew
- Common Hebrew terms: סה"כ (total), מע"מ (VAT), חשבונית (invoice), קבלה (receipt), פריט (item)
- OCR text may have garbled Hebrew — focus on recognizable patterns and numbers near keywords`

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

async function callMiniMax(ocrText: string): Promise<ExtractionResult> {
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

export async function extractDocument(
  fileRelativePath: string,
  fileType: string
): Promise<ExtractionResult> {
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

  return callMiniMax(ocrText)
}

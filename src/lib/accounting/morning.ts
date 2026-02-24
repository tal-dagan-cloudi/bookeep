import type { AccountingExpense, AccountingExportResult } from "./types"

const MORNING_API_BASE = "https://api.greeninvoice.co.il/api/v1"

export async function exportToMorning(
  apiKey: string,
  apiSecret: string,
  expense: AccountingExpense
): Promise<AccountingExportResult> {
  try {
    // Authenticate
    const authResponse = await fetch(`${MORNING_API_BASE}/account/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: apiKey, secret: apiSecret }),
    })

    if (!authResponse.ok) {
      return { success: false, error: "Morning authentication failed" }
    }

    const { token } = (await authResponse.json()) as { token: string }

    // Create expense document
    const docResponse = await fetch(`${MORNING_API_BASE}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 320, // Expense receipt type
        lang: expense.currency === "ILS" ? "he" : "en",
        currency: expense.currency,
        date: expense.date,
        dueDate: expense.date,
        client: {
          name: expense.vendorName,
        },
        income: expense.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          price: item.unitPrice,
          currency: expense.currency,
          vatType: 0, // Standard VAT
        })),
        remarks: expense.documentNumber
          ? `Bookeep ref: ${expense.documentNumber}`
          : "Imported via Bookeep",
        draft: true, // Create as draft for user review
      }),
    })

    if (!docResponse.ok) {
      const errBody = await docResponse.text()
      return {
        success: false,
        error: `Morning API error: ${errBody}`,
      }
    }

    const doc = (await docResponse.json()) as { id: string }
    return { success: true, externalId: doc.id }
  } catch (error) {
    return {
      success: false,
      error: `Morning export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

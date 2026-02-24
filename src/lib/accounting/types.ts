export type AccountingProvider =
  | "quickbooks"
  | "xero"
  | "morning"
  | "icount"
  | "freshbooks"

export type AccountingExpense = {
  vendorName: string
  amount: number
  tax: number
  currency: string
  date: string
  description: string
  documentNumber: string | null
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    tax: number
  }>
}

export type AccountingExportResult = {
  success: boolean
  externalId?: string
  error?: string
}

export type AccountingIntegration = {
  provider: AccountingProvider
  name: string
  isConnected: boolean
  connect: () => Promise<string> // returns auth URL
  disconnect: () => Promise<void>
  exportExpense: (
    expense: AccountingExpense,
    attachmentBuffer?: Buffer,
    attachmentName?: string
  ) => Promise<AccountingExportResult>
}

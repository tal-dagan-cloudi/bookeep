"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import {
  Mail,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
} from "lucide-react"

type EmailAccount = {
  id: string
  provider: string
  emailAddress: string
  syncStatus: string
  lastSyncAt: string | null
  createdAt: string
}

export default function IntegrationsPage() {
  const t = useTranslations("integrations")
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  const success = searchParams.get("success")
  const error = searchParams.get("error")

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/email/accounts")
      if (!res.ok) throw new Error("Failed to fetch accounts")
      const data = await res.json()
      setAccounts(data.accounts)
    } catch (err) {
      console.error("Failed to fetch accounts:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleSync = useCallback(
    async (accountId: string) => {
      setSyncingIds((prev) => new Set([...prev, accountId]))
      try {
        const res = await fetch(`/api/email/accounts/${accountId}/sync`, {
          method: "POST",
        })
        if (!res.ok) throw new Error("Sync failed")
        await fetchAccounts()
      } catch (err) {
        console.error("Sync failed:", err)
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev)
          next.delete(accountId)
          return next
        })
      }
    },
    [fetchAccounts]
  )

  const handleDisconnect = useCallback(
    async (accountId: string) => {
      if (!confirm(t("confirmDisconnect"))) return
      try {
        const res = await fetch(`/api/email/accounts/${accountId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Delete failed")
        await fetchAccounts()
      } catch (err) {
        console.error("Disconnect failed:", err)
      }
    },
    [fetchAccounts, t]
  )

  const statusIcon = (status: string) => {
    switch (status) {
      case "syncing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Status Messages */}
      {success === "gmail_connected" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm">{t("gmailConnected")}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{t("connectionError")}</p>
        </div>
      )}

      {/* Email Connections */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("emailAccounts")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("emailDescription")}
        </p>

        {/* Connect Buttons */}
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/email/gmail/connect"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Mail className="h-4 w-4" />
            {t("connectGmail")}
          </a>
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium opacity-50"
          >
            <Mail className="h-4 w-4" />
            {t("connectOutlook")}
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {t("comingSoon")}
            </span>
          </button>
        </div>

        {/* Connected Accounts */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <Mail className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("noAccounts")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(account.syncStatus)}
                  <div>
                    <p className="text-sm font-medium">
                      {account.emailAddress}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.provider.toUpperCase()}
                      {account.lastSyncAt &&
                        ` · ${t("lastSync")}: ${new Date(account.lastSyncAt).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(account.id)}
                    disabled={
                      syncingIds.has(account.id) ||
                      account.syncStatus === "syncing"
                    }
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncingIds.has(account.id) ? "animate-spin" : ""
                      }`}
                    />
                    {t("syncNow")}
                  </button>
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("disconnect")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

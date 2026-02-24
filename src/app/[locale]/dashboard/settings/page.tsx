"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle, ExternalLink, Loader2 } from "lucide-react"

type AccountingConnection = {
  provider: string
  label: string
  description: string
  status: "disconnected" | "connected" | "coming_soon"
  fields?: Array<{ key: string; label: string; type: string }>
}

const PROVIDERS: AccountingConnection[] = [
  {
    provider: "morning",
    label: "Morning (Green Invoice)",
    description: "Israeli accounting - חשבונית ירוקה",
    status: "disconnected",
    fields: [
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "apiSecret", label: "API Secret", type: "password" },
    ],
  },
  {
    provider: "icount",
    label: "iCount",
    description: "Israeli accounting software",
    status: "coming_soon",
  },
  {
    provider: "quickbooks",
    label: "QuickBooks Online",
    description: "Intuit QuickBooks accounting",
    status: "coming_soon",
  },
  {
    provider: "xero",
    label: "Xero",
    description: "Cloud accounting for small business",
    status: "coming_soon",
  },
  {
    provider: "freshbooks",
    label: "FreshBooks",
    description: "Invoice and expense tracking",
    status: "coming_soon",
  },
]

export default function SettingsPage() {
  const t = useTranslations("settings")
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async (provider: string) => {
    setSaving(true)
    // Store credentials in localStorage for now
    // In production, these would be encrypted and stored server-side
    localStorage.setItem(
      `bookeep_${provider}_credentials`,
      JSON.stringify(credentials)
    )
    setSaving(false)
    setExpandedProvider(null)
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Accounting Integrations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("accountingIntegrations")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("accountingDescription")}
        </p>

        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div key={p.provider} className="rounded-lg border">
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                </div>
                {p.status === "coming_soon" ? (
                  <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {t("comingSoon")}
                  </span>
                ) : p.status === "connected" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t("connected")}
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      setExpandedProvider(
                        expandedProvider === p.provider
                          ? null
                          : p.provider
                      )
                    }
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t("connect")}
                  </button>
                )}
              </div>

              {expandedProvider === p.provider && p.fields && (
                <div className="border-t p-4">
                  <div className="space-y-3">
                    {p.fields.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          value={credentials[field.key] || ""}
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              [field.key]: e.target.value,
                            })
                          }
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleSave(p.provider)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {t("saveCredentials")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { FileText, Inbox, Clock, Mail } from "lucide-react"
import { Link } from "@/i18n/navigation"

type DashboardStats = {
  totalDocuments: number
  thisMonth: number
  pendingReview: number
  connectedEmails: number
}

type RecentDocument = {
  id: string
  fileName: string
  status: string
  createdAt: string
  vendor?: string
  amount?: number
  currency?: string
}

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const tDoc = useTranslations("documents")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const [statsRes, docsRes] = await Promise.all([
        fetch("/api/billing/usage"),
        fetch("/api/documents?limit=5"),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          totalDocuments: data.usage.documents.used,
          thisMonth: data.usage.documents.used,
          pendingReview: 0,
          connectedEmails: data.usage.emailInboxes.used,
        })
      }

      if (docsRes.ok) {
        const data = await docsRes.json()
        setRecentDocs(data.documents || [])
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label={t("stats.totalDocuments")}
          value={String(stats?.totalDocuments ?? 0)}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label={t("stats.thisMonth")}
          value={String(stats?.thisMonth ?? 0)}
        />
        <StatCard
          icon={<Inbox className="h-5 w-5" />}
          label={t("stats.pendingReview")}
          value={String(stats?.pendingReview ?? 0)}
        />
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          label={t("stats.connectedEmails")}
          value={String(stats?.connectedEmails ?? 0)}
        />
      </div>

      {/* Recent Documents */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("recentDocuments")}</h2>
          {recentDocs.length > 0 && (
            <Link
              href="/dashboard/documents"
              className="text-sm font-medium text-primary hover:underline"
            >
              {tDoc("title")} →
            </Link>
          )}
        </div>

        {recentDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-xl font-semibold">{t("noDocuments")}</h3>
            <p className="mt-2 text-muted-foreground">{t("uploadFirst")}</p>
            <Link
              href="/dashboard/documents"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {tDoc("upload")}
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">File</th>
                  <th className="px-4 py-3 text-start font-medium">Vendor</th>
                  <th className="px-4 py-3 text-start font-medium">Amount</th>
                  <th className="px-4 py-3 text-start font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{doc.fileName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.vendor || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.amount
                        ? `${doc.currency || ""}${doc.amount}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-background p-6 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800",
    reviewed: "bg-purple-100 text-purple-800",
    exported: "bg-gray-100 text-gray-800",
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  )
}

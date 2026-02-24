import { useTranslations } from "next-intl"
import { FileText, Inbox, Clock, Mail } from "lucide-react"

export default function DashboardPage() {
  const t = useTranslations("dashboard")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label={t("stats.totalDocuments")}
          value="0"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label={t("stats.thisMonth")}
          value="0"
        />
        <StatCard
          icon={<Inbox className="h-5 w-5" />}
          label={t("stats.pendingReview")}
          value="0"
        />
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          label={t("stats.connectedEmails")}
          value="0"
        />
      </div>

      <div className="mt-12 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t("noDocuments")}</h2>
        <p className="mt-2 text-muted-foreground">{t("uploadFirst")}</p>
      </div>
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
    <div className="rounded-lg border bg-background p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

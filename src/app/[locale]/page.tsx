import { useTranslations } from "next-intl"
import { FileText, Mail, MessageSquare, Upload } from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { Link } from "@/i18n/navigation"

export default function LandingPage() {
  const t = useTranslations("landing")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Bookeep</span>
          </div>
          <nav className="flex items-center gap-4">
            <LocaleSwitcher />
            <Link
              href="/auth/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("hero.ctaSecondary")}
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("hero.cta")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("hero.cta")}
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">
              {t("features.title")}
            </h2>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Mail className="h-8 w-8" />}
                title={t("features.emailScan.title")}
                description={t("features.emailScan.description")}
              />
              <FeatureCard
                icon={<FileText className="h-8 w-8" />}
                title={t("features.aiExtraction.title")}
                description={t("features.aiExtraction.description")}
              />
              <FeatureCard
                icon={<MessageSquare className="h-8 w-8" />}
                title={t("features.whatsapp.title")}
                description={t("features.whatsapp.description")}
              />
              <FeatureCard
                icon={<Upload className="h-8 w-8" />}
                title={t("features.export.title")}
                description={t("features.export.description")}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Bookeep. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-background p-6">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

import { useTranslations } from "next-intl"
import {
  FileText,
  Mail,
  MessageSquare,
  Upload,
  CheckCircle,
  Zap,
} from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { Link } from "@/i18n/navigation"

export default function LandingPage() {
  const t = useTranslations("landing")
  const tAuth = useTranslations("auth")

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
              {tAuth("signIn")}
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
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Zap className="h-5 w-5" />
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

        {/* Pricing */}
        <section className="border-t py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">
              {t("pricing.title")}
            </h2>
            <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
              <PricingCard
                name={t("pricing.free.name")}
                price={t("pricing.free.price")}
                period={t("pricing.free.period")}
                features={[
                  t("pricing.free.features.0"),
                  t("pricing.free.features.1"),
                  t("pricing.free.features.2"),
                  t("pricing.free.features.3"),
                ]}
                ctaText={t("hero.cta")}
                ctaHref="/auth/sign-up"
                variant="outline"
              />
              <PricingCard
                name={t("pricing.business.name")}
                price={t("pricing.business.price")}
                period={t("pricing.business.period")}
                features={[
                  t("pricing.business.features.0"),
                  t("pricing.business.features.1"),
                  t("pricing.business.features.2"),
                  t("pricing.business.features.3"),
                  t("pricing.business.features.4"),
                  t("pricing.business.features.5"),
                  t("pricing.business.features.6"),
                ]}
                ctaText={t("hero.cta")}
                ctaHref="/auth/sign-up"
                variant="primary"
                highlighted
              />
              <PricingCard
                name={t("pricing.accountant.name")}
                price={t("pricing.accountant.price")}
                period={t("pricing.accountant.period")}
                features={[
                  t("pricing.accountant.features.0"),
                  t("pricing.accountant.features.1"),
                  t("pricing.accountant.features.2"),
                  t("pricing.accountant.features.3"),
                  t("pricing.accountant.features.4"),
                ]}
                ctaText={t("hero.cta")}
                ctaHref="/auth/sign-up"
                variant="outline"
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
    <div className="rounded-lg border bg-background p-6 transition-shadow hover:shadow-md">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PricingCard({
  name,
  price,
  period,
  features,
  ctaText,
  ctaHref,
  variant,
  highlighted,
}: {
  name: string
  price: string
  period: string
  features: string[]
  ctaText: string
  ctaHref: string
  variant: "primary" | "outline"
  highlighted?: boolean
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-8 ${
        highlighted
          ? "relative border-primary ring-2 ring-primary/20"
          : "border-border"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          Popular
        </span>
      )}
      <h3 className="text-xl font-bold">{name}</h3>
      <div className="mt-4">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground"> / {period}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
          variant === "primary"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border hover:bg-muted"
        }`}
      >
        {ctaText}
      </Link>
    </div>
  )
}

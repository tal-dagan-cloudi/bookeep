"use client"

import { useLocale } from "next-intl"
import { Globe } from "lucide-react"

import { usePathname, useRouter } from "@/i18n/navigation"

const localeLabels: Record<string, string> = {
  en: "English",
  he: "עברית",
}

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const nextLocale = locale === "en" ? "he" : "en"

  function handleSwitch() {
    router.replace(pathname, { locale: nextLocale })
  }

  return (
    <button
      onClick={handleSwitch}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Switch to ${localeLabels[nextLocale]}`}
    >
      <Globe className="h-4 w-4" />
      <span>{localeLabels[nextLocale]}</span>
    </button>
  )
}

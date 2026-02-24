import { UserButton } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import {
  FileText,
  LayoutDashboard,
  FolderOpen,
  Plug,
  Settings,
  CreditCard,
} from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { Link } from "@/i18n/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations("nav")

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { href: "/dashboard/documents", icon: FileText, label: t("documents") },
    { href: "/dashboard/categories", icon: FolderOpen, label: t("categories") },
    { href: "/dashboard/integrations", icon: Plug, label: t("integrations") },
    { href: "/dashboard/settings", icon: Settings, label: t("settings") },
    { href: "/dashboard/billing", icon: CreditCard, label: t("billing") },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-e bg-muted/30 md:block">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Bookeep</span>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-4 border-b px-6">
          <LocaleSwitcher />
          <UserButton />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"

type Category = {
  id: string
  name: string
  color: string
  icon: string | null
}

type Entity = {
  id: string
  name: string
  isDefault: boolean
}

export default function CategoriesPage() {
  const t = useTranslations("categories")
  const [categories, setCategories] = useState<Category[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Category form
  const [showCatForm, setShowCatForm] = useState(false)
  const [catName, setCatName] = useState("")
  const [catColor, setCatColor] = useState("#6366f1")

  // Entity form
  const [showEntForm, setShowEntForm] = useState(false)
  const [entName, setEntName] = useState("")
  const [entDefault, setEntDefault] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [catRes, entRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/entities"),
      ])
      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(catData.categories)
      }
      if (entRes.ok) {
        const entData = await entRes.json()
        setEntities(entData.entities)
      }
    } catch (err) {
      console.error("Failed to fetch:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateCategory = useCallback(async () => {
    if (!catName.trim()) return
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, color: catColor }),
      })
      if (res.ok) {
        setCatName("")
        setCatColor("#6366f1")
        setShowCatForm(false)
        await fetchData()
      }
    } catch (err) {
      console.error("Failed to create category:", err)
    }
  }, [catName, catColor, fetchData])

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      if (!confirm(t("confirmDelete"))) return
      try {
        await fetch(`/api/categories/${id}`, { method: "DELETE" })
        await fetchData()
      } catch (err) {
        console.error("Failed to delete category:", err)
      }
    },
    [fetchData, t]
  )

  const handleCreateEntity = useCallback(async () => {
    if (!entName.trim()) return
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: entName, isDefault: entDefault }),
      })
      if (res.ok) {
        setEntName("")
        setEntDefault(false)
        setShowEntForm(false)
        await fetchData()
      }
    } catch (err) {
      console.error("Failed to create entity:", err)
    }
  }, [entName, entDefault, fetchData])

  const handleDeleteEntity = useCallback(
    async (id: string) => {
      if (!confirm(t("confirmDelete"))) return
      try {
        await fetch(`/api/entities/${id}`, { method: "DELETE" })
        await fetchData()
      } catch (err) {
        console.error("Failed to delete entity:", err)
      }
    },
    [fetchData, t]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Categories Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("expenseCategories")}</h2>
          <button
            onClick={() => setShowCatForm(!showCatForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("addCategory")}
          </button>
        </div>

        {showCatForm && (
          <div className="flex items-end gap-3 rounded-lg border p-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("categoryName")}
              </label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder={t("categoryNamePlaceholder")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("color")}
              </label>
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border"
              />
            </div>
            <button
              onClick={handleCreateCategory}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("save")}
            </button>
          </div>
        )}

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
            <Tag className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("noCategories")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium">{cat.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Business Entities Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("businessEntities")}</h2>
          <button
            onClick={() => setShowEntForm(!showEntForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("addEntity")}
          </button>
        </div>

        {showEntForm && (
          <div className="flex items-end gap-3 rounded-lg border p-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("entityName")}
              </label>
              <input
                type="text"
                value={entName}
                onChange={(e) => setEntName(e.target.value)}
                placeholder={t("entityNamePlaceholder")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entDefault}
                onChange={(e) => setEntDefault(e.target.checked)}
                className="rounded"
              />
              {t("setAsDefault")}
            </label>
            <button
              onClick={handleCreateEntity}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("save")}
            </button>
          </div>
        )}

        {entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
            <Tag className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("noEntities")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entities.map((ent) => (
              <div
                key={ent.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ent.name}</span>
                  {ent.isDefault && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      {t("default")}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteEntity(ent.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

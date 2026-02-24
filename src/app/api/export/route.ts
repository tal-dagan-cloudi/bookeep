import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { exportToCsv, exportToJson } from "@/lib/export"

const exportSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
  format: z.enum(["csv", "json"]),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = exportSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { documentIds, format } = parsed.data

  if (format === "csv") {
    const csv = await exportToCsv(documentIds)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="bookeep-export-${Date.now()}.csv"`,
      },
    })
  }

  const json = await exportToJson(documentIds)
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bookeep-export-${Date.now()}.json"`,
    },
  })
}

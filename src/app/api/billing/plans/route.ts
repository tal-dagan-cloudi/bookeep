import { NextRequest, NextResponse } from "next/server"

import { PLANS, getPriceForLocale } from "@/lib/billing"

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en"

  const plans = Object.values(PLANS).map((plan) => ({
    ...plan,
    price: getPriceForLocale(plan, locale),
  }))

  return NextResponse.json({ plans })
}

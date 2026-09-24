import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const recent = await prisma.post.findMany({
    where: { text: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { text: true },
  })

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-haiku",
      messages: [
        {
          role: "system",
          content: "Write one short, anonymous Ghanaian university campus confession or joke post, under 200 characters, casual student tone. Never mention real people. Respond with only the post text, nothing else.",
        },
        { role: "user", content: `Style examples:\n${recent.map((r) => r.text).join("\n")}` },
      ],
    }),
  })
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()

  if (text) {
    await prisma.aiDraft.create({ data: { text: text.toLowerCase() } })
  }

  return NextResponse.json({ success: true })
}
import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const alt = "yard post"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

function clip(s: string, n: number) {
  const t = (s || "").trim()
  return t.length > n ? `${t.slice(0, n)}...` : t
}

// Stylish unfurl card for shared posts/answers. Pure text/shapes (no
// emoji — font-safe). Answers (type "ask") render as Q&A cards.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let ghostId = "a ghost"
  let text = ""
  let yeahs = 0
  let isAsk = false
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        text: true,
        type: true,
        yeahs: true,
        user: { select: { ghostId: true } },
      },
    })
    if (post) {
      ghostId = post.user.ghostId
      text = post.text || ""
      yeahs = post.yeahs
      isAsk = post.type === "ask"
    }
  } catch {}

  let kicker = `${ghostId} on yard`
  let body = clip(text, 220)
  if (isAsk) {
    const parts = text.split("\n\n")
    const q = clip((parts[0] || "").replace(/^anonymous asked:\s*/i, ""), 140)
    const a = clip(parts.slice(1).join("\n\n"), 140)
    kicker = "anonymous asked:"
    body = q + (a ? `\n— ${a}` : "")
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050505",
          backgroundImage: "linear-gradient(180deg, rgba(186,255,57,0.14), transparent 45%)",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 900, color: "#ffffff", letterSpacing: -1 }}>
          YARD<span style={{ color: "#baff39" }}>.</span>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#baff39", fontWeight: 700 }}>
          {clip(kicker, 60)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 40,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {clip(body, 220) || "a post on yard"}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "rgba(255,255,255,0.5)" }}>
          {yeahs} heats — yardapp.me
        </div>
      </div>
    ),
    { ...size },
  )
}

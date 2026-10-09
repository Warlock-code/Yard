import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const alt = "ask me anonymously on yard"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// NGL-style share card: this is what unfurls on WhatsApp status when
// someone shares their ask link. Pure text/shapes (no emoji — font-safe).
// Fail-open: crawlers get a generic card even if the DB is slow.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const clean = (code || "").trim().toUpperCase()

  let ghostId = "a ghost"
  let campus = "your campus"
  try {
    const person = await prisma.user.findUnique({
      where: { inviteCode: clean },
      select: { ghostId: true, campus: true },
    })
    if (person) {
      ghostId = person.ghostId
      if (person.campus) campus = person.campus
    }
  } catch {}

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
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 900, color: "#ffffff", letterSpacing: -1 }}>
          YARD<span style={{ color: "#baff39" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            padding: "28px 56px",
            borderRadius: 28,
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "2px solid rgba(186,255,57,0.5)",
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
          }}
        >
          ask {ghostId} anything
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 32, color: "rgba(186,255,57,0.9)" }}>
          {campus}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: "rgba(255,255,255,0.55)" }}>
          100% anonymous — tap the link to ask
        </div>
      </div>
    ),
    { ...size },
  )
}

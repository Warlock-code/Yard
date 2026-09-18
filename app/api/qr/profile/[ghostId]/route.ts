import { NextRequest, NextResponse } from "next/server"
import { generateProfileQRCode } from "@/lib/qr"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ghostId: string }> }
) {
  const { ghostId } = await params

  try {
    const qrCode = await generateProfileQRCode(ghostId)
    return NextResponse.json({ qrCode })
  } catch (err) {
    console.error("QR code generation failed:", err)
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 })
  }
}
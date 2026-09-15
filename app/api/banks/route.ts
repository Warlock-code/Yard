import { NextResponse } from "next/server"

export async function GET() {
  const res = await fetch("https://api.paystack.co/bank?currency=GHS&type=mobile_money", {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })
  const data = await res.json()
  return NextResponse.json({ banks: data.data })
}
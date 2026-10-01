function getPaystackSecret(): string {
  const s = process.env.PAYSTACK_SECRET_KEY
  if (!s) throw new Error("PAYSTACK_SECRET_KEY missing")
  const mode = process.env.PAYSTACK_MODE || (s.startsWith("sk_test_") ? "test" : s.startsWith("sk_live_") ? "live" : "")
  if (mode !== "test" && mode !== "live") throw new Error("PAYSTACK_MODE must be 'test' or 'live'")
  if (process.env.NODE_ENV === "production" && mode !== "live") throw new Error("Production requires PAYSTACK_MODE=live")
  if (process.env.NODE_ENV !== "production" && mode !== "test") throw new Error("Non-production requires PAYSTACK_MODE=test")
  if ((mode === "test" && !s.startsWith("sk_test_")) || (mode === "live" && !s.startsWith("sk_live_"))) {
    throw new Error("PAYSTACK_SECRET_KEY does not match PAYSTACK_MODE")
  }
  return s
}
const CALLBACK_URL = "https://yardapp.me/payment/callback"

export async function initializePaystack(email: string, amountKobo: number, reference: string) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, amount: amountKobo, reference, callback_url: CALLBACK_URL }),
  })
  const data = await res.json()
  if (!res.ok || data.status === false) {
    throw new Error(data.message || data.error || `Paystack init failed (${res.status})`)
  }
  if (!data.data?.authorization_url) {
    throw new Error(data.message || "Paystack did not return checkout URL")
  }
  return data
}

export async function verifyPaystack(reference: string) {
  if (!reference || !/^[A-Za-z0-9._-]+$/.test(reference)) {
    throw new Error("Invalid Paystack reference")
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${getPaystackSecret()}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== true || !data.data) {
    throw new Error(data.message || `Paystack verification failed (${res.status})`)
  }
  return data
}

export async function initializeSubscription(email: string, planCode: string, reference: string, amountPesewas?: number) {
  if (!planCode || planCode.includes("xxxx") || planCode.length < 6 || planCode === "PLN_test_xxxxxxxxxx") {
    throw new Error("Subscription plan not configured. Admin: set PAYSTACK_PLUS/ PRIME_PLAN_CODE to real Paystack plan code (PLN_...) in .env / Vercel env.")
  }
  // Paystack amount is in kobo/pesewas. Send amount explicitly to avoid 'Invalid amount' when plan amount mismatched.
  const body: Record<string, unknown> = { email, plan: planCode, reference, callback_url: CALLBACK_URL }
  if (typeof amountPesewas === "number" && Number.isSafeInteger(amountPesewas) && amountPesewas > 0) {
    body.amount = amountPesewas
  }
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.status === false) {
    console.error("[paystack] initializeSubscription failed", { planCode, amountPesewas, status: res.status, data })
    // Surface Paystack's message but clarify common cause
    const msg = data.message || data.error || `Paystack subscription init failed (${res.status})`
    if (msg.toLowerCase().includes("amount")) {
      throw new Error(`${msg} — check that Paystack plan ${planCode} exists, is active, amount matches ${amountPesewas} pesewas (GHS ${((amountPesewas||0)/100).toFixed(2)}), interval=monthly, and uses same test/live key as PAYSTACK_SECRET_KEY.`)
    }
    throw new Error(msg)
  }
  if (!data.data?.authorization_url) {
    throw new Error(data.message || "Paystack did not return checkout URL for subscription")
  }
  return data
}

const MOMO_BANK_CODES = new Set(["MTN", "VOD", "ATL", "AFB", "TIGO", "MTN_GH", "VOD_GH"])

export async function createTransferRecipient(name: string, accountNumber: string, bankCode: string) {
  const isMomo = MOMO_BANK_CODES.has(bankCode.trim().toUpperCase())
  const res = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: isMomo ? "mobile_money" : "ghipss",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "GHS",
    }),
  })
  return res.json()
}

export async function initiateTransfer(
  amountPesewas: number,
  recipientCode: string,
  reason: string,
  reference?: string
) {
  const res = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountPesewas,
      recipient: recipientCode,
      reason,
      ...(reference ? { reference } : {}),
    }),
  })
  return res.json()
}
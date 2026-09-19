function getPaystackSecret(): string {
  const s = process.env.PAYSTACK_SECRET_KEY
  if (!s) throw new Error("PAYSTACK_SECRET_KEY missing")
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
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${getPaystackSecret()}` },
  })
  return res.json()
}

export async function initializeSubscription(email: string, planCode: string, reference: string) {
  if (!planCode || planCode.includes("xxxx") || planCode.includes("test_")) {
    throw new Error("Subscription plan not configured. Admin: set PAYSTACK_PLUS/ PRIME_PLAN_CODE to real Paystack plan code (PLN_...) in Vercel env.")
  }
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, plan: planCode, reference, callback_url: CALLBACK_URL }),
  })
  const data = await res.json()
  if (!res.ok || data.status === false) {
    throw new Error(data.message || data.error || `Paystack subscription init failed (${res.status})`)
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
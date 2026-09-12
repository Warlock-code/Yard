const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!

export async function initializePaystack(email: string, amountKobo: number, reference: string) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, amount: amountKobo, reference }),
  })
  return res.json()
}

export async function verifyPaystack(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  })
  return res.json()
}

export async function initializeSubscription(email: string, planCode: string, reference: string) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, plan: planCode, reference }),
  })
  return res.json()
}

export async function createTransferRecipient(name: string, accountNumber: string, bankCode: string) {
  const res = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "ghipss", // Ghana mobile money/bank transfer type
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "GHS",
    }),
  })
  return res.json()
}

export async function initiateTransfer(amountPesewas: number, recipientCode: string, reason: string) {
  const res = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountPesewas,
      recipient: recipientCode,
      reason,
    }),
  })
  return res.json()
}
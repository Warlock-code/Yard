import crypto from "crypto"

function getKey(): Buffer {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY
  if (!raw || raw.length < 16) {
    throw new Error("PAYOUT_ENCRYPTION_KEY missing or too short — set 32+ char key. Refusing to encrypt with fallback.")
  }
  // Derive 32-byte key via SHA-256 so any length input works
  return crypto.createHash("sha256").update(raw).digest()
}

const IV_LENGTH = 16

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getKey()
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

export function decrypt(hash: string): string {
  const [ivHex, encrypted] = hash.split(":")
  if (!ivHex || !encrypted) throw new Error("Invalid encrypted format")
  const iv = Buffer.from(ivHex, "hex")
  if (iv.length !== IV_LENGTH) throw new Error("Invalid IV length")
  const key = getKey()
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (e) {
    throw e instanceof Error ? e : new Error("Failed to decrypt")
  }
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "****"
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}
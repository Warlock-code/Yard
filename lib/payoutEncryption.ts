import crypto from "crypto"

const ENCRYPTION_KEY = process.env.PAYOUT_ENCRYPTION_KEY || process.env.DATABASE_URL?.slice(0, 32).padEnd(32, "0") || "0".repeat(32)
const IV_LENGTH = 16

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

export function decrypt(hash: string): string {
  const [ivHex, encrypted] = hash.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv)
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "****"
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}
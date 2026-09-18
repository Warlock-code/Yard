import crypto from "crypto"

function getKey(): Buffer {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET || "dev_fallback_key_change_in_prod_32_bytes_long!"
  // Derive 32-byte key via SHA-256 so any length input works and avoids weak slicing of DATABASE_URL
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
  // Try new derived key first, then fallback to legacy raw-slice key for old rows
  const keysToTry: Buffer[] = [getKey()]
  const legacyRaw = process.env.PAYOUT_ENCRYPTION_KEY || (process.env.DATABASE_URL?.slice(0, 32).padEnd(32, "0") as string) || "0".repeat(32)
  if (legacyRaw) {
    // legacy used Buffer.from(raw,"utf-8") directly as 32-byte key (padded/truncated)
    const legacyKey = Buffer.from(legacyRaw.slice(0, 32).padEnd(32, "0"), "utf-8")
    // avoid duplicate if same as new
    if (!legacyKey.equals(keysToTry[0])) keysToTry.push(legacyKey)
  }
  let lastErr: unknown = null
  for (const key of keysToTry) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return decrypted
    } catch (e) { lastErr = e }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to decrypt")
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "****"
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}
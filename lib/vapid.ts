import crypto from "node:crypto"

function cleanSecret(value: string | undefined): string {
  let cleaned = (value || "").trim()
  // Vercel/dotenv values sometimes keep surrounding quotes or escaped newlines.
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned.replace(/\\n/g, "\n")
}

function rawPrivateKeyBytes(value: string): Buffer | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const bytes = Buffer.from(normalized, "base64")
  return bytes.length === 32 ? bytes : null
}

function normalizePublicKey(value: string): string {
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("base64url")
  } catch {
    return value
  }
}

/**
 * Derive the uncompressed P-256 public key from a VAPID private key.
 *
 * `web-push generate-vapid-keys` returns a raw 32-byte base64url private key
 * (not PKCS#8), but PEM keys are accepted too. Deriving the public key means
 * the server can never serve a public key that does not match the key used to
 * sign pushes — a mismatch makes every push fail with 401/403.
 */
export function derivePublicKeyFromPrivate(privateKey: string): string | null {
  const key = cleanSecret(privateKey)
  if (!key) return null

  if (key.includes("BEGIN")) {
    try {
      const jwk = crypto.createPrivateKey(key).export({ format: "jwk" }) as {
        crv?: string
        x?: string
        y?: string
      }
      if (jwk.crv !== "P-256" || !jwk.x || !jwk.y) return null
      return Buffer.concat([
        Buffer.from([4]),
        Buffer.from(jwk.x, "base64url"),
        Buffer.from(jwk.y, "base64url"),
      ]).toString("base64url")
    } catch {
      return null
    }
  }

  const bytes = rawPrivateKeyBytes(key)
  if (!bytes) return null
  try {
    const ecdh = crypto.createECDH("prime256v1")
    ecdh.setPrivateKey(bytes)
    return ecdh.getPublicKey(null, "uncompressed").toString("base64url")
  } catch {
    return null
  }
}

export type VapidConfig = {
  configured: boolean
  publicKey: string
  privateKey: string
  source: "private-derived" | "env-public" | "none"
  warning: string | null
}

/**
 * The public key is intentionally public (browsers need it for
 * `pushManager.subscribe`). The private key is read only on the server.
 *
 * Preferring the key derived from VAPID_PRIVATE_KEY also makes production
 * resilient when NEXT_PUBLIC_VAPID_PUBLIC_KEY was not present at build time:
 * NEXT_PUBLIC_* values are inlined into the client bundle by `next build`, so
 * a missing build-time env var otherwise leaves the browser with an empty key
 * and it never subscribes at all.
 */
export function getVapidConfig(): VapidConfig {
  const privateKey = cleanSecret(process.env.VAPID_PRIVATE_KEY)
  const envPublicKey = cleanSecret(process.env.VAPID_PUBLIC_KEY) || cleanSecret(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const derivedPublicKey = derivePublicKeyFromPrivate(privateKey)

  if (privateKey && derivedPublicKey) {
    if (envPublicKey && normalizePublicKey(envPublicKey) !== derivedPublicKey) {
      const warning =
        "VAPID public key does not match VAPID_PRIVATE_KEY; serving the public key derived from the private key."
      console.error("[PUSH CONFIG]", warning)
      return {
        configured: true,
        publicKey: derivedPublicKey,
        privateKey,
        source: "private-derived",
        warning,
      }
    }
    return {
      configured: true,
      publicKey: derivedPublicKey,
      privateKey,
      source: "private-derived",
      warning: null,
    }
  }

  if (envPublicKey) {
    return {
      configured: false,
      publicKey: normalizePublicKey(envPublicKey),
      privateKey,
      source: "env-public",
      warning: "VAPID_PRIVATE_KEY is missing or is not a valid P-256 private key.",
    }
  }

  return {
    configured: false,
    publicKey: "",
    privateKey,
    source: "none",
    warning: "VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY are both missing.",
  }
}

import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import crypto from "crypto"

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 16) throw new Error("JWT_SECRET missing or too short")
  return s
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "30d" })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string }
  } catch {
    return null
  }
}

const ghostAdjectives = [
  "Silent", "Campus", "Tea", "Shadow", "Anon", "Night", "Masked", "Quiet", "Hidden", "Drift",
  "Phantom", "Ghostly", "Secret", "Unknown", "Mystic", "Stealth", "Cloaked", "Veiled", "Obscure", "Faint",
  "Whisper", "Echo", "Shade", "Spectral", "Ethereal", "Unseen", "Invisible", "Covert", "Sly", "Elusive",
]

const ghostNouns = [
  "Owl", "Ghost", "Walker", "Pal", "Vibe", "Crawler", "Fox", "Storm", "Gem", "Kid",
  "Spirit", "Wraith", "Shade", "Phantom", "Apparition", "Specter", "Shadow", "Echo", "Whisper", "Mist",
  "Raven", "Cat", "Wolf", "Bat", "Rat", "Toad", "Newt", "Moth", "Beetle", "Spider",
]

export function makeGhostId() {
  const adj = ghostAdjectives[crypto.randomInt(ghostAdjectives.length)]
  const noun = ghostNouns[crypto.randomInt(ghostNouns.length)]
  const num = crypto.randomInt(1000, 10000)
  return `${adj}${noun}_${num}`
}

export function makeVerifyCode() {
  return crypto.randomInt(100000, 999999).toString()
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url")
}
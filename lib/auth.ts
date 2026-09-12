import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

const JWT_SECRET = process.env.JWT_SECRET!

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

const ghostNames = [
  "SilentOwl", "CampusGhost", "TeaWalker", "ShadowPal", "AnonVibe",
  "NightCrawler", "MaskedFox", "QuietStorm", "HiddenGem", "DriftKid",
]

export function makeGhostId() {
  const name = ghostNames[Math.floor(Math.random() * ghostNames.length)]
  const num = Math.floor(10 + Math.random() * 90)
  return `${name}_${num}`
}

export function makeVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6-digit
}
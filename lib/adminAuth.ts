import jwt from "jsonwebtoken"

function getAdminSecret(): string {
  const s = process.env.ADMIN_JWT_SECRET
  if (!s || s.length < 16) throw new Error("ADMIN_JWT_SECRET missing or too short")
  return s
}

export function signAdminToken() {
  return jwt.sign({ role: "admin" }, getAdminSecret(), { expiresIn: "7d" })
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, getAdminSecret()) as { role: string }
    return payload.role === "admin"
  } catch {
    return false
  }
}
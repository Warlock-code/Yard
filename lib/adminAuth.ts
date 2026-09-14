import jwt from "jsonwebtoken"

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET!

export function signAdminToken() {
  return jwt.sign({ role: "admin" }, ADMIN_SECRET, { expiresIn: "7d" })
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, ADMIN_SECRET) as { role: string }
    return payload.role === "admin"
  } catch {
    return false
  }
}
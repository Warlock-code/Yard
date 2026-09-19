import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key.includes("xxxxxxxx")) {
    return null
  }
  return new Resend(key)
}

export async function sendVerifyEmail(email: string, code: string) {
  const resend = getResend()
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY missing or placeholder — skipping email send. Code for", email, "is", code)
    if (process.env.NODE_ENV !== "production") {
      return { skipped: true as const, code }
    }
    throw new Error("Email service not configured. Please contact support.")
  }

  try {
    const { error } = await resend.emails.send({
      from: "Yard <noreply@yardapp.me>",
      to: email,
      subject: "Your Yard verification code",
      html: `<p>Your code is: <strong>${code}</strong></p><p>Enter it in the app to verify your account.</p><p>This code expires in 30 minutes.</p>`,
    })
    if (error) {
      console.error("[resend] send failed:", error)
      throw new Error(error.message || "Failed to send verification email")
    }
  } catch (err) {
    console.error("[resend] exception sending to", email, err)
    throw err instanceof Error ? err : new Error("Failed to send verification email")
  }
}

export async function sendResetEmail(email: string, resetUrl: string) {
  const resend = getResend()
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY missing or placeholder — skipping reset email send. URL for", email, "is", resetUrl)
    if (process.env.NODE_ENV !== "production") {
      return { skipped: true as const, resetUrl }
    }
    throw new Error("Email service not configured. Please contact support.")
  }

  try {
    const { error } = await resend.emails.send({
      from: "Yard <noreply@yardapp.me>",
      to: email,
      subject: "Reset your Yard password",
      html: `<p>You requested to reset your password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#baff39;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p><p>Or copy this link: ${resetUrl}</p><p>This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
    })
    if (error) {
      console.error("[resend] send failed:", error)
      throw new Error(error.message || "Failed to send reset email")
    }
  } catch (err) {
    console.error("[resend] exception sending reset to", email, err)
    throw err instanceof Error ? err : new Error("Failed to send reset email")
  }
}
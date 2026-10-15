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
      subject: `👻 your yard code: ${code}`,
      html: `<div style="background:#050505;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:32px 24px;text-align:center;"><div style="font-weight:900;letter-spacing:-0.04em;font-size:28px;color:#baff39;">YARD.</div><p style="color:rgba(245,245,245,0.6);font-size:14px;">your campus whisper network</p><p style="font-size:14px;">your verification code:</p><div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#baff39;background:rgba(186,255,57,0.08);border:1px solid rgba(186,255,57,0.3);border-radius:12px;padding:16px;margin:16px auto;max-width:320px;">${code}</div><p style="color:rgba(245,245,245,0.6);font-size:13px;">enter it in the app to verify your account. this code expires in 30 minutes.</p><p style="color:rgba(245,245,245,0.35);font-size:12px;margin-top:24px;">yardapp.me</p></div>`,
      text: `YARD. — your campus whisper network\n\nyour verification code: ${code}\n\nenter it in the app to verify your account. this code expires in 30 minutes.\n\nyardapp.me`,
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
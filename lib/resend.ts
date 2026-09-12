import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerifyEmail(email: string, code: string) {
  await resend.emails.send({
    from: "Yard <onboarding@resend.dev>", // swap once you verify your own domain
    to: email,
    subject: "Your Yard verification code",
    html: `<p>Your code is: <strong>${code}</strong></p><p>Enter it in the app to verify your account.</p>`,
  })
}
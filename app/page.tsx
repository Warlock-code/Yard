import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/auth"

export default async function RootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("yard_token")?.value

  if (token && verifyToken(token)) {
    redirect("/feed")
  }

  // First-visit onboarding gate: logged-out users without the welcome
  // cookie see /welcome once. Returning users (cookie set) go to /signup.
  // Logged-in users are never affected (handled above).
  const seenWelcome = cookieStore.get("yard_seen_welcome")?.value
  if (!seenWelcome) {
    redirect("/welcome")
  }

  redirect("/signup")
}
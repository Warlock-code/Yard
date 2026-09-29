import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/auth"

export default async function RootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("yard_token")?.value

  if (token && verifyToken(token)) {
    redirect("/feed")
  }

  redirect("/signup")
}
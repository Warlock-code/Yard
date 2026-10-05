import { NextResponse } from "next/server"
import { APP_VERSION } from "@/lib/appVersion"

export const dynamic = "force-dynamic"

// Public: the in-app updater calls this to learn the newest/blocked builds.
export async function GET() {
  return NextResponse.json(
    {
      latestBuild: APP_VERSION.ANDROID_LATEST_BUILD,
      latestVersion: APP_VERSION.ANDROID_LATEST_VERSION,
      minBuild: APP_VERSION.ANDROID_MIN_BUILD,
      apkUrl: APP_VERSION.APK_URL,
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  )
}

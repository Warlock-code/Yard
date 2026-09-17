import { google } from "googleapis"

type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

function getServiceAccount(): FirebaseServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) {
    console.error("FCM is not configured: FIREBASE_SERVICE_ACCOUNT is missing")
    return null
  }

  try {
    const unwrapped = raw.replace(/^'([\s\S]*)'$/, "$1").replace(/^\"([\s\S]*)\"$/, "$1")
    const key = JSON.parse(unwrapped) as FirebaseServiceAccount
    if (!key.project_id || !key.client_email || !key.private_key) throw new Error("Incomplete Firebase service account")
    return { ...key, private_key: key.private_key.replace(/\\n/g, "\n") }
  } catch (error) {
    console.error("FCM is not configured: invalid FIREBASE_SERVICE_ACCOUNT", error)
    return null
  }
}

async function getAccessToken() {
  const key = getServiceAccount()
  if (!key) return null
  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })
  const tokens = await jwtClient.authorize()
  return tokens.access_token
}

export async function sendPush(pushToken: string, title: string, body: string, href?: string) {
  if (!pushToken) {
    console.error("FCM notification skipped: recipient has no registered device token")
    return
  }
  try {
    const key = getServiceAccount()
    if (!key) return
    const accessToken = await getAccessToken()
    if (!accessToken) return

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: pushToken,
          notification: { title, body },
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "yard-v2",
              sound: "default",
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
          data: href ? { href } : undefined,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("FCM notification failed", response.status, errorBody)
    }
  } catch (error) {
    console.error("FCM notification could not be sent", error)
  }
}
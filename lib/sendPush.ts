import { google } from "googleapis"

async function getAccessToken() {
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })
  const tokens = await jwtClient.authorize()
  return tokens.access_token
}

export async function sendPush(pushToken: string, title: string, body: string) {
  if (!pushToken) return
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
  const accessToken = await getAccessToken()

  await fetch(`https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: pushToken,
        notification: { title, body },
      },
    }),
  })
}
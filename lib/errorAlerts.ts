type AlertContext = {
  route: string
  error: unknown
  metadata?: Record<string, string | number | boolean | null>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function reportServerError({ route, error, metadata }: AlertContext): Promise<void> {
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL
  const payload = {
    content: `[yard] server error in ${route}: ${errorMessage(error)}`,
    route,
    environment: process.env.NODE_ENV || "unknown",
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
  }

  console.error(`[${route}]`, error, metadata || {})
  if (!webhookUrl) return

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) console.error(`[${route}] error alert webhook returned ${response.status}`)
  } catch (alertError) {
    console.error(`[${route}] error alert delivery failed`, alertError)
  }
}

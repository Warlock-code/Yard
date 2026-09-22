export async function logPaywallHit(feature: string, pathname?: string): Promise<void> {
  try {
    const path =
      pathname ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
    await fetch("/api/paywall-hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ feature, pathname: path }),
    }).catch(() => {});
  } catch {}
}

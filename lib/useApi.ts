export async function apiPost(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}

  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}

export async function apiGet(url: string) {
  const res = await fetch(url, { credentials: "include" })

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}

  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}

export async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE", credentials: "include" })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}

export async function apiPatch(url: string, body: any) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}
/* eslint-disable @typescript-eslint/no-explicit-any -- api helpers intentionally return any for backward compat */
export async function apiPost(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }

  if (!res.ok) throw new Error(data?.error || data?.message || `Something went wrong (${res.status}). Please try again.`)
  return data
}

export async function apiGet(url: string): Promise<any> {
  const res = await fetch(url, { credentials: "include" })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }

  if (!res.ok) throw new Error(data?.error || data?.message || `Something went wrong (${res.status}).`)
  return data
}

export async function apiDelete(url: string): Promise<any> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" })
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }
  if (!res.ok) throw new Error(data?.error || data?.message || `Something went wrong (${res.status}).`)
  return data
}

export async function apiPatch(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }
  if (!res.ok) throw new Error(data?.error || data?.message || `Something went wrong (${res.status}).`)
  return data
}
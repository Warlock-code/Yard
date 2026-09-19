"use client"

import { useEffect, useState } from "react"
import { useRoutePrefetch } from "@/lib/prefetch"

export function RoutePrefetcher() {
  const [mounted, setMounted] = useState(false)
  useRoutePrefetch()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  return null
}
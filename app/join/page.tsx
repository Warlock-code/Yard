"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get("ref")

  useEffect(() => {
    if (ref) {
      router.push(`/signup?ref=${ref}`)
    } else {
      router.push("/signup")
    }
  }, [ref, router])

  return null
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  )
}
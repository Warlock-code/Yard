"use client"

import { ErrorBoundary } from "./ErrorBoundary"
import { ReactNode } from "react"

export function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
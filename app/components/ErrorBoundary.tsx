"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import Link from "next/link"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null }
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#050505]">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-xl font-bold text-white mb-2">something went wrong</h1>
            <p className="text-white/50 text-sm mb-6">
              {this.state.error?.message || "an unexpected error occurred"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary px-4 py-2"
              >
                refresh page
              </button>
              <Link href="/feed" className="btn-ghost px-4 py-2">
                go to feed
              </Link>
            </div>
            <details className="mt-6 text-left text-xs text-white/30">
              <summary className="cursor-pointer mb-2">error details</summary>
              <pre className="bg-black/50 p-3 rounded overflow-auto text-left">
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
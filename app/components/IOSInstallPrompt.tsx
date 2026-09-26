"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export default function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    const init = () => {
      setIsIOS(iOS)
      setIsInStandaloneMode(standalone)

      if (iOS && !standalone) {
        const dismissed = localStorage.getItem("ios-install-dismissed")
        const dismissTime = dismissed ? parseInt(dismissed, 10) : 0
        const now = Date.now()
        const oneWeek = 7 * 24 * 60 * 60 * 1000

        if (!dismissed || now - dismissTime > oneWeek) {
          const timer = setTimeout(() => {
            setShowPrompt(true)
          }, 10000)
          return () => clearTimeout(timer)
        }
      }
    }

    init()
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("ios-install-dismissed", Date.now().toString())
  }

  const handleGotIt = () => {
    setShowPrompt(false)
    localStorage.setItem("ios-install-dismissed", Date.now().toString())
  }

  if (!isIOS || isInStandaloneMode || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pb-safe animate-slide-up">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl max-w-md mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-base">Install Yard</h3>
              <p className="text-gray-400 text-sm mt-0.5">Add to Home Screen for full-screen app experience &mdash; no browser bars</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-800">
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center flex-shrink-0">1</span>
              Tap the <strong className="text-white">Share</strong> button <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center flex-shrink-0">2</span>
              Scroll down and tap <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center flex-shrink-0">3</span>
              Tap <strong className="text-white">&ldquo;Add&rdquo;</strong> &mdash; Yard opens like a native app
            </li>
          </ol>
        </div>
        <button
          onClick={handleGotIt}
          className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
"use client"

import { useEffect, useRef, useState, useCallback } from "react"

type BattleVoteUpdate = {
  type: "VOTE_UPDATE"
  entryId: string
  votes: number
  voterId?: string
}

type BattleRoundUpdate = {
  type: "ROUND_UPDATE"
  promptId: string
  roundNumber: number
  status: "ACTIVE" | "VOTING" | "COMPLETED"
  entries?: Array<{ id: string; votes: number; wonRound: boolean }>
}

type BattleNotification = {
  type: "NOTIFICATION"
  title: string
  body: string
  href: string
}

type BattleSocketMessage = BattleVoteUpdate | BattleRoundUpdate | BattleNotification

export function useBattleSocket(promptId: string | null, campus: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [liveVotes, setLiveVotes] = useState<Record<string, number>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    if (!promptId) return

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001"}/battle/${promptId}?campus=${encodeURIComponent(campus)}`

    try {
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: BattleSocketMessage = JSON.parse(event.data)

          if (message.type === "VOTE_UPDATE") {
            setLiveVotes((prev) => ({ ...prev, [message.entryId]: message.votes }))
          } else if (message.type === "ROUND_UPDATE") {
            window.dispatchEvent(new CustomEvent("battle-round-update", { detail: message }))
          } else if (message.type === "NOTIFICATION") {
            window.dispatchEvent(new CustomEvent("battle-notification", { detail: message }))
          }
        } catch {
          console.error("Failed to parse battle socket message")
        }
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        if (reconnectAttempts.current < 5) {
          reconnectAttempts.current++
          reconnectTimeoutRef.current = setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts.current - 1))
        }
      }

      wsRef.current.onerror = () => {
        setIsConnected(false)
      }
    } catch {
      setIsConnected(false)
    }
  }, [promptId, campus])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendVote = useCallback((entryId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "VOTE", entryId }))
    }
  }, [])

  return { isConnected, liveVotes, sendVote }
}
"use client"

import { useEffect, useRef, useState, useCallback, type DependencyList } from "react"
import io from "socket.io-client"

type SocketEvents = {
  new_post: (post: any) => void
  vote_update: (data: { postId: string; yeahs: number }) => void
  comment_added: (data: { postId: string; comment: any }) => void
  comment_vote: (data: { postId: string; commentId: string; yeahs: number }) => void
  notification: (notification: any) => void
  battle_vote: (data: { entryId: string; votes: number }) => void
  battle_update: (data: any) => void
}

export type NewPostEvent = SocketEvents["new_post"]
export type VoteUpdateEvent = SocketEvents["vote_update"]

type TypedSocket = ReturnType<typeof io>

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    let socket: TypedSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (cancelled || socket) return
      // Live updates are non-critical: defer past first paint so the
      // websocket/polling handshake never contends with the feed fetch.
      // yard_token is httpOnly so document.cookie won't carry it — connect
      // anyway and let the server authenticate via the Cookie header
      // (same-origin polling sends cookies automatically). Fail-open.
      let token: string | undefined
      try {
        token = document.cookie.split("yard_token=")[1]?.split(";")[0]
      } catch {
        token = undefined
      }

      try {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_APP_URL || ""
        const s = io(socketUrl, {
          path: "/api/socket",
          ...(token ? { auth: { token } } : {}),
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        })

        s.on("connect", () => { if (!cancelled) setConnected(true) })
        s.on("disconnect", () => { if (!cancelled) setConnected(false) })
        s.on("connect_error", (err: Error) => console.error("Socket error:", err.message))

        socket = s
        socketRef.current = s
      } catch {}
    }

    const schedule = () => {
      if (document.hidden) {
        // Wait for foreground instead of handshaking in background.
        const onVisible = () => {
          if (!document.hidden) {
            document.removeEventListener("visibilitychange", onVisible)
            connect()
          }
        }
        document.addEventListener("visibilitychange", onVisible)
        timer = setTimeout(() => {
          document.removeEventListener("visibilitychange", onVisible)
          connect()
        }, 8000)
        return
      }
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(connect, { timeout: 6000 })
      } else {
        timer = setTimeout(connect, 3000)
      }
    }
    schedule()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
      try { socket?.disconnect() } catch {}
      socketRef.current = null
    }
  }, [])

  const on = useCallback(<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    socketRef.current?.on(event, handler)
    return () => {
      socketRef.current?.off(event, handler)
    }
     
  }, []) as <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => () => void

  const emit = useCallback(<K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]) => {
    socketRef.current?.emit(event, data)
  }, [])

  const joinCampus = useCallback((campus: string) => {
    socketRef.current?.emit("join:campus", campus)
  }, [])

  const leaveCampus = useCallback((campus: string) => {
    socketRef.current?.emit("leave:campus", campus)
  }, [])

  const joinBattle = useCallback((battleId: string) => {
    socketRef.current?.emit("join:battle", battleId)
  }, [])

  const leaveBattle = useCallback((battleId: string) => {
    socketRef.current?.emit("leave:battle", battleId)
  }, [])

  return { connected, on, emit, joinCampus, leaveCampus, joinBattle, leaveBattle }
}

export function useSocketEvent<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K], deps: DependencyList = []) {
  const { on } = useSocket()
  useEffect(() => {
    const cleanup = on(event, handler)
    return cleanup
  }, deps)
}

export function useBattleSocket(battleId: string | null) {
  const { on, joinBattle, leaveBattle } = useSocket()

  useEffect(() => {
    if (!battleId) return
    joinBattle(battleId)
    return () => leaveBattle(battleId)
  }, [battleId, joinBattle, leaveBattle])

  return { on }
}
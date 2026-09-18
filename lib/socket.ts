"use client"

import { useEffect, useRef, useState, useCallback, type DependencyList } from "react"
import io from "socket.io-client"

type SocketEvents = {
  new_post: (post: any) => void
  vote_update: (data: { postId: string; yeahs: number }) => void
  comment_added: (data: { postId: string; comment: any }) => void
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
    const token = document.cookie.split("yard_token=")[1]?.split(";")[0]
    if (!token) return

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || "", {
      path: "/api/socket",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("connect_error", (err: Error) => console.error("Socket error:", err.message))

    socketRef.current = socket
    return () => {
      socket.disconnect()
    }
  }, [])

  const on = useCallback(<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    socketRef.current?.on(event, handler)
    return () => {
      socketRef.current?.off(event, handler)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
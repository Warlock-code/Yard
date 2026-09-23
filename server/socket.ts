import { Server as HTTPServer } from "http"
import { Server, type Socket } from "socket.io"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

const JWT_SECRET = process.env.JWT_SECRET!

interface AuthenticatedSocket extends Socket {
  userId?: string
  campus?: string
}

interface PostData {
  id: string
  text: string | null
  imageUrl: string | null
  type: string
  yeahs: number
  commentsCount: number
  boosted: boolean
  createdAt: string
  user: { id: string; ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
  campus: string
}

interface CommentData {
  postId: string
  comment: {
    id: string
    postId: string
    text: string
    ghostId: string
    user: {
      ghostId: string
      avatarEmoji: string
      tier?: string
      championTrophies?: number
    }
    parentId: string | null
    yeahs: number
    createdAt: string
  }
}

interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  href: string
  actorName?: string
  readAt: string | null
  createdAt: string
}

interface BattleVoteData {
  entryId: string
  votes: number
}

interface BattleEntryData {
  id: string
  text: string | null
  votes: number
  isPrime: boolean
  user: { ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
}

interface BattleUpdateData {
  id: string
  status: string
  roundNumber: number
  endsAt: string
  entries?: BattleEntryData[]
}

const userSockets = new Map<string, Set<string>>()
const campusRooms = new Map<string, Set<string>>()
const battleRooms = new Map<string, Set<string>>()

let ioInstance: ReturnType<typeof initializeSocket> | null = null

export function initializeSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    path: "/api/socket",
  })

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split("yard_token=")[1]?.split(";")[0]
      if (!token) return next(new Error("No token"))

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, campus: true, tier: true },
      })
      if (!user) return next(new Error("User not found"))

      socket.userId = user.id
      socket.campus = user.campus
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  io.on("connection", (socket: AuthenticatedSocket) => {
    const { userId, campus } = socket

    if (!userSockets.has(userId!)) userSockets.set(userId!, new Set())
    userSockets.get(userId!)!.add(socket.id)

    socket.join(`user:${userId}`)
    socket.join(`campus:${campus}`)

    if (!campusRooms.has(campus!)) campusRooms.set(campus!, new Set())
    campusRooms.get(campus!)!.add(socket.id)

    socket.on("join:battle", (battleId: string) => {
      socket.join(`battle:${battleId}`)
      if (!battleRooms.has(battleId)) battleRooms.set(battleId, new Set())
      battleRooms.get(battleId)!.add(socket.id)
    })

    socket.on("leave:battle", (battleId: string) => {
      socket.leave(`battle:${battleId}`)
      battleRooms.get(battleId)?.delete(socket.id)
    })

    socket.on("disconnect", () => {
      userSockets.get(userId!)?.delete(socket.id)
      if (userSockets.get(userId!)?.size === 0) userSockets.delete(userId!)
      campusRooms.get(campus!)?.delete(socket.id)
      battleRooms.forEach((sockets, bid) => {
        sockets.delete(socket.id)
        if (sockets.size === 0) battleRooms.delete(bid)
      })
    })
  })

  ioInstance = io
  return io
}

export function emitNewPost(campus: string, post: PostData) {
  ioInstance?.to(`campus:${campus}`).emit("new_post", post)
}

export function emitVoteUpdate(campus: string, postId: string, yeahs: number) {
  ioInstance?.to(`campus:${campus}`).emit("vote_update", { postId, yeahs })
}

export function emitCommentAdded(campus: string, postId: string, comment: CommentData) {
  ioInstance?.to(`campus:${campus}`).emit("comment_added", { postId, comment })
}

export function emitCommentVote(campus: string, postId: string, commentId: string, yeahs: number) {
  ioInstance?.to(`campus:${campus}`).emit("comment_vote", { postId, commentId, yeahs })
}

export function emitNotification(userId: string, notification: NotificationData) {
  ioInstance?.to(`user:${userId}`).emit("notification", notification)
}

export function emitBattleVote(battleId: string, entryId: string, votes: number) {
  ioInstance?.to(`battle:${battleId}`).emit("battle_vote", { entryId, votes })
}

export function emitBattleUpdate(battleId: string, data: BattleUpdateData) {
  ioInstance?.to(`battle:${battleId}`).emit("battle_update", data)
}

export function getOnlineUsers(campus: string): number {
  return campusRooms.get(campus)?.size || 0
}

export const emitPostNew = emitNewPost
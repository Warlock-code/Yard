import { Server as HTTPServer } from "http"
import { Server, type Socket } from "socket.io"
import { createClient } from "redis"
import { createAdapter } from "@socket.io/redis-adapter"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"

const JWT_SECRET = process.env.JWT_SECRET!
const SOCKET_SECRET = process.env.SOCKET_SECRET || process.env.CRON_SECRET!

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

const prisma = new PrismaClient()

async function initializeSocket() {
  const httpServer = new HTTPServer()
  
  const pubClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" })
  const subClient = pubClient.duplicate()
  
  await pubClient.connect()
  await subClient.connect()

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    path: "/api/socket",
    adapter: createAdapter(pubClient, subClient),
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

    socket.join(`user:${userId}`)
    socket.join(`campus:${campus}`)

    socket.on("join:battle", (battleId: string) => {
      socket.join(`battle:${battleId}`)
    })

    socket.on("leave:battle", (battleId: string) => {
      socket.leave(`battle:${battleId}`)
    })

    socket.on("disconnect", () => {
      // cleanup handled by redis adapter
    })
  })

  // HTTP endpoint for Next.js to emit events
  httpServer.on("request", async (req, res) => {
    if (req.method === "POST" && req.url === "/emit") {
      let body = ""
      for await (const chunk of req) body += chunk
      
      try {
        const { event, data } = JSON.parse(body)
        
        // Verify secret
        const auth = req.headers.authorization
        if (auth !== `Bearer ${SOCKET_SECRET}`) {
          res.writeHead(401, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Unauthorized" }))
          return
        }

        switch (event) {
          case "new_post":
            io.to(`campus:${data.campus}`).emit("new_post", data.post)
            break
          case "vote_update":
            io.to(`campus:${data.campus}`).emit("vote_update", { postId: data.postId, yeahs: data.yeahs })
            break
          case "comment_added":
            io.to(`campus:${data.campus}`).emit("comment_added", { postId: data.postId, comment: data.comment })
            break
          case "comment_vote":
            io.to(`campus:${data.campus}`).emit("comment_vote", { postId: data.postId, commentId: data.commentId, yeahs: data.yeahs })
            break
          case "notification":
            io.to(`user:${data.userId}`).emit("notification", data.notification)
            break
          case "battle_vote":
            io.to(`battle:${data.battleId}`).emit("battle_vote", { entryId: data.entryId, votes: data.votes })
            break
          case "battle_update":
            io.to(`battle:${data.battleId}`).emit("battle_update", data.data)
            break
          default:
            res.writeHead(400, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Unknown event" }))
            return
        }

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid request" }))
      }
      return
    }
    
    // Let Socket.io handle other requests
    res.writeHead(404)
    res.end()
  })

  return { io, httpServer, pubClient, subClient }
}

let ioInstance: Awaited<ReturnType<typeof initializeSocket>> | null = null

export async function startSocketServer() {
  const { io, httpServer, pubClient, subClient } = await initializeSocket()
  
  const port = parseInt(process.env.SOCKET_PORT || "3001", 10)
  
  httpServer.listen(port, () => {
    console.log(`> Socket.io server ready on port ${port}`)
  })

  ioInstance = { io, httpServer, pubClient, subClient }
  return io
}

export function emitNewPost(campus: string, post: PostData) {
  ioInstance?.io.to(`campus:${campus}`).emit("new_post", post)
}

export function emitVoteUpdate(campus: string, postId: string, yeahs: number) {
  ioInstance?.io.to(`campus:${campus}`).emit("vote_update", { postId, yeahs })
}

export function emitCommentAdded(campus: string, postId: string, comment: CommentData) {
  ioInstance?.io.to(`campus:${campus}`).emit("comment_added", { postId, comment })
}

export function emitCommentVote(campus: string, postId: string, commentId: string, yeahs: number) {
  ioInstance?.io.to(`campus:${campus}`).emit("comment_vote", { postId, commentId, yeahs })
}

export function emitNotification(userId: string, notification: NotificationData) {
  ioInstance?.io.to(`user:${userId}`).emit("notification", notification)
}

export function emitBattleVote(battleId: string, entryId: string, votes: number) {
  ioInstance?.io.to(`battle:${battleId}`).emit("battle_vote", { entryId, votes })
}

export function emitBattleUpdate(battleId: string, data: BattleUpdateData) {
  ioInstance?.io.to(`battle:${battleId}`).emit("battle_update", data)
}

export function getOnlineUsers(campus: string): number {
  return 0
}

export const emitPostNew = emitNewPost

if (require.main === module) {
  startSocketServer().catch(console.error)
}
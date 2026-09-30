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

interface BattleUpdateData {
  id: string
  status: string
  roundNumber: number
  endsAt: string
  entries?: Array<{
    id: string
    text: string | null
    votes: number
    isPrime: boolean
    user: { ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
  }>
}

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
const SOCKET_SECRET = process.env.SOCKET_SECRET || process.env.CRON_SECRET

async function emitToSocketServer(event: string, data: unknown) {
  if (!SOCKET_SECRET) {
    console.warn("SOCKET_SECRET not set, skipping socket emit")
    return
  }
  try {
    await fetch(`${SOCKET_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SOCKET_SECRET}`,
      },
      body: JSON.stringify({ event, data }),
    })
  } catch (e) {
    console.error("Failed to emit to socket server:", e)
  }
}

export function emitNewPost(campus: string, post: PostData) {
  emitToSocketServer("new_post", { campus, post })
}

export function emitVoteUpdate(campus: string, postId: string, yeahs: number) {
  emitToSocketServer("vote_update", { campus, postId, yeahs })
}

export function emitCommentAdded(campus: string, postId: string, comment: CommentData) {
  emitToSocketServer("comment_added", { campus, postId, comment })
}

export function emitCommentVote(campus: string, postId: string, commentId: string, yeahs: number) {
  emitToSocketServer("comment_vote", { campus, postId, commentId, yeahs })
}

export function emitNotification(userId: string, notification: NotificationData) {
  emitToSocketServer("notification", { userId, notification })
}

export function emitBattleVote(battleId: string, entryId: string, votes: number) {
  emitToSocketServer("battle_vote", { battleId, entryId, votes })
}

export function emitBattleUpdate(battleId: string, data: BattleUpdateData) {
  emitToSocketServer("battle_update", { battleId, data })
}

export const emitPostNew = emitNewPost
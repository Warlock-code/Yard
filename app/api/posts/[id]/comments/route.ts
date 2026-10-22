import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createNotification } from "@/lib/notifications"
import { notifyMentions } from "@/lib/mentions"
import { rateLimit } from "@/lib/rateLimit"
import { getReadablePostWhere } from "@/lib/programAccess"
import { emitCommentAdded } from "@/lib/socket-client"
import { attachChampionTrophiesDeep } from "@/lib/champions"
import { evalReplyVelocityNudge } from "@/lib/nudges"


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const post = await prisma.post.findFirst({
    where: { id, AND: [await getReadablePostWhere(user)] },
    include: { user: true },
  })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })

  const { text: rawText, parentId } = await req.json()
  const text = typeof rawText === "string" ? rawText.toLowerCase() : rawText
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "comment can't be empty." }, { status: 400 })
  if (typeof text !== "string" || text.length > 500) {
    return NextResponse.json({ error: "comment must be 500 characters or fewer." }, { status: 400 })
  }
  if (!(await rateLimit(`comment:${user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "too many comments. Try again later." }, { status: 429 })
  }

  if (parentId) {
    if (typeof parentId !== "string") return NextResponse.json({ error: "invalid reply." }, { status: 400 })
    const parent = await prisma.comment.findFirst({ where: { id: parentId, postId: id }, select: { id: true } })
    if (!parent) return NextResponse.json({ error: "comment not found." }, { status: 404 })
  }

  // Anonymous reply threads (the DM replacement — everything stays public).
  // First 3 replies per ghost per post are free, then 20cr/reply.
  // Any @ghost mention in the text adds a flat 50cr mention fee.
  // Reportability: Report targets Post only — flagging the post covers its
  // whole thread (comment-level reports are not yet supported; comments
  // inherit the post's reportability).
  const { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } = await import("@/lib/credits")
  const myReplies = await prisma.comment.count({ where: { postId: id, userId: user.id } })
  const feeStamp = Date.now()
  const replyReference = `reply_${user.id}_${id}_${feeStamp}`
  const mentionReference = `mention_${user.id}_${id}_${feeStamp}`
  let replyFeeCharged = false
  let mentionFeeCharged = false
  if (myReplies >= 3) {
    try {
      await creditUser(user.id, "REPLY", -CREDIT_CONFIG.SPEND.REPLY_EXTRA, replyReference, {
        postId: id,
        parentId: parentId || null,
      })
      replyFeeCharged = true
    } catch (err) {
      return toCreditErrorResponse(err, "replies cost 20cr after your first 3.")
    }
  }
  const hasMention = /(^|\s)@[a-z0-9_]{3,24}/.test(text)
  if (hasMention) {
    try {
      await creditUser(user.id, "MENTION", -CREDIT_CONFIG.SPEND.ANON_MENTION, mentionReference, {
        postId: id,
      })
      mentionFeeCharged = true
    } catch (err) {
      // Reply fee already taken above (if any) — refund it so a failed
      // mention never leaves a half-paid reply behind.
      if (replyFeeCharged) {
        await creditUser(user.id, "REPLY", CREDIT_CONFIG.SPEND.REPLY_EXTRA, `${replyReference}_refund`, {
          refund: true,
        }).catch(() => {})
      }
      return toCreditErrorResponse(err, "mentions cost 50cr.")
    }
  }
  await trackFeatureEvent({
    userId: user.id,
    type: "reply",
    metadata: { postId: id, threaded: !!parentId, mention: hasMention },
  })

  const comment = await prisma.comment.create({
    data: {
      postId: id,
      userId: user.id,
      ghostId: user.ghostId,
      text,
      parentId: parentId || null,
    },
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
  }).catch(async (err: unknown) => {
    // Never keep reply/mention fees when the comment row itself failed.
    if (mentionFeeCharged) {
      await creditUser(user.id, "MENTION", CREDIT_CONFIG.SPEND.ANON_MENTION, `${mentionReference}_refund`, {
        refund: true,
      }).catch(() => {})
    }
    if (replyFeeCharged) {
      await creditUser(user.id, "REPLY", CREDIT_CONFIG.SPEND.REPLY_EXTRA, `${replyReference}_refund`, {
        refund: true,
      }).catch(() => {})
    }
    console.error("[comments] create failed", err)
    return null
  })
  if (!comment) {
    return NextResponse.json({ error: "couldn't post reply. try again." }, { status: 500 })
  }

  await prisma.post.update({
    where: { id },
    data: { commentsCount: { increment: 1 } },
  })

  if (post) {
    if (post.userId !== user.id) {
      await createNotification({
        userId: post.userId,
        pushToken: post.user.pushToken,
        type: "comment",
        title: "new comment",
        body: `${user.ghostId} replied to your post`,
        href: `/post/${post.id}`,
        actorName: user.ghostId,
      })
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true, user: { select: { pushToken: true } } },
      })
      if (
        parentComment &&
        parentComment.userId !== post.userId &&
        parentComment.userId !== user.id
      ) {
        await createNotification({
          userId: parentComment.userId,
          pushToken: parentComment.user.pushToken,
          type: "reply",
          title: "new reply",
          body: `${user.ghostId} replied to your comment`,
          href: `/post/${id}`,
          actorName: user.ghostId,
        })
      }
    }
  }

  await notifyMentions({ text, senderUser: user, href: `/post/${post?.id ?? id}`, excludeUserId: user.id }).catch(() => {})

  // Heating-up nudge: best-effort, never fails the comment.
  evalReplyVelocityNudge(id).catch(() => {})

  await attachChampionTrophiesDeep(comment)
  emitCommentAdded(post.campus, comment.postId, {
    postId: comment.postId,
    comment: {
      id: comment.id,
      postId: comment.postId,
      text: comment.text,
      ghostId: comment.ghostId,
      user: {
        ghostId: comment.user.ghostId,
        avatarEmoji: comment.user.avatarEmoji,
        tier: comment.user.tier,
        championTrophies: (comment.user as { championTrophies?: number }).championTrophies ?? 0,
      },
      parentId: comment.parentId,
      yeahs: 0,
      createdAt: comment.createdAt.toISOString(),
    },
  })

  return NextResponse.json({ comment: { ...comment, yeahs: 0 } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })
  const post = await prisma.post.findFirst({ where: { id, AND: [await getReadablePostWhere(user)] }, select: { id: true } })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })

  const sort = new URL(req.url).searchParams.get("sort") === "latest" ? "latest" : "top"

  const all = await prisma.comment.findMany({
    where: { postId: id },
    include: {
      user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } },
      votes: { where: { userId: user.id }, select: { id: true } },
    },
  })

  type Node = (typeof all)[number] & { heated: boolean; replies: Node[] }
  const byId = new Map<string, Node>()
  for (const c of all) byId.set(c.id, { ...c, heated: c.votes.length > 0, replies: [] })
  const roots: Node[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  // X-style weighing: heat matters, but fresh comments still get a shot (HN-style gravity).
  function hotScore(yeahs: number, createdAt: Date) {
    const ageHrs = Math.max(0, (Date.now() - createdAt.getTime()) / 3.6e6)
    return yeahs / Math.pow(ageHrs + 2, 1.2)
  }

  function sortReplies(nodes: Node[]) {
    nodes.sort((a, b) => b.yeahs - a.yeahs || a.createdAt.getTime() - b.createdAt.getTime())
    for (const n of nodes) sortReplies(n.replies)
  }

  if (sort === "latest") {
    roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } else {
    roots.sort(
      (a, b) => hotScore(b.yeahs, b.createdAt) - hotScore(a.yeahs, a.createdAt)
    )
  }
  for (const r of roots) sortReplies(r.replies)

  await attachChampionTrophiesDeep(roots)

  const strip = (n: Node): unknown => ({
    id: n.id,
    text: n.text,
    ghostId: n.ghostId,
    yeahs: n.yeahs,
    heated: n.heated,
    createdAt: n.createdAt,
    parentId: n.parentId,
    user: n.user,
    replies: n.replies.map(strip),
  })

  // Top-reply crown: highest-heat comment (earliest wins ties), crowned at 3+ heat.
  let topReplyId: string | null = null
  let topHeat = 3
  for (const c of all) {
    if (c.yeahs >= topHeat && (topReplyId === null || c.yeahs > topHeat)) {
      topHeat = c.yeahs
      topReplyId = c.id
    }
  }

  return NextResponse.json({ comments: roots.map(strip), sort, topReplyId })
}
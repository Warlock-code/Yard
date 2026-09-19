"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { shareContent, getShareTargets, ShareTarget } from "@/lib/share"
import { useSocket } from "@/lib/socket"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"

type Comment = {
  id: string
  text: string
  ghostId: string
  user: { ghostId: string; avatarEmoji: string }
  createdAt: string
  parentId: string | null
  replies: Comment[]
}

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  yeahs: number
  commentsCount: number
  createdAt: string
  user: { ghostId: string; avatarEmoji: string; tier: string }
}

function CommentThread({
  comment,
  onReply,
}: {
  comment: Comment
  onReply: (parentId: string, ghostId: string) => void
}) {
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <Link href={`/u/${encodeURIComponent(comment.user.ghostId)}`} aria-label={`View ${comment.user.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
          <Avatar emoji={comment.user.avatarEmoji} size={32} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/u/${encodeURIComponent(comment.user.ghostId)}`} aria-label={`View ${comment.user.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
              {comment.user.ghostId}
            </Link>
            <span className="text-xs text-white/40">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-white/90 mt-0.5">{comment.text}</p>
          <button
            className="text-xs text-white/40 hover:text-white mt-1"
            onClick={() => onReply(comment.id, comment.ghostId)}
          >
            Reply
          </button>
        </div>
      </div>

      {comment.replies?.length > 0 && (
        <div className="ml-10 border-l border-white/10 pl-3 mt-2">
          {comment.replies.map((reply) => (
            <CommentThread key={reply.id} comment={reply} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  )
}

function ShareButton({ postId, postText }: { postId: string; postText?: string }) {
  const [showMenu, setShowMenu] = useState(false)
  const targets = getShareTargets()

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Share post"
        aria-expanded={showMenu}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 text-purple-200 hover:text-purple-100 focus-visible:outline-[#baff39]"
      >
        🔗 Share
      </button>
      {showMenu && (
        <div className="absolute bottom-full right-0 mb-2 card p-2 min-w-[140px] shadow-lg border border-white/10 z-10">
          {targets.map((target) => (
            <button
              key={target}
              onClick={() => {
                shareContent({ type: "post", id: postId, text: postText }, target)
                setShowMenu(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded focus-visible:outline-[#baff39]"
            >
              {target === "native" && "📤 Native Share"}
              {target === "whatsapp" && "💬 WhatsApp"}
              {target === "twitter" && "🐦 X (Twitter)"}
              {target === "copy" && "📋 Copy Link"}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PostDetailClient({ postId }: { postId: string }) {
  const router = useRouter()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ id: string; ghostId: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { connected, on } = useSocket()

  async function loadComments() {
    try {
      const data = await apiGet(`/api/posts/${postId}/comments`)
      setComments(data.comments)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    let active = true

    async function loadPost() {
      try {
        const response = await fetch(`/api/posts/${postId}`, { credentials: "include", cache: "no-store" })
        if (!active) return
        if (response.status === 401) throw new Error("Not authenticated.")
        if (response.status === 404) return
        if (!response.ok) throw new Error(`Unable to load post (${response.status}). Please try again.`)
        const data = await response.json()
        if (!active) return
        if (!data.post) throw new Error("Unable to load post. Please try again.")
        setPost(data.post)
        try {
          const data = await apiGet(`/api/posts/${postId}/comments`)
          if (active) setComments(data.comments)
        } catch (err) {
          console.error(err)
        }
      } catch (err: unknown) {
        if (!active) return
        if (err instanceof Error && err.message === "Not authenticated.") {
          router.push("/login")
        }
        setError(err instanceof Error ? err.message : "Unable to load post. Please try again.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPost()
    return () => { active = false }
  }, [postId, router])

  useEffect(() => {
    if (!connected || !post) return
    const unsubComment = on("comment_added", ({ postId: pId, comment }: { postId: string; comment: Comment }) => {
      if (pId === postId) {
        setComments((prev) => {
          if (comment.parentId) {
            return prev.map((c) => {
              if (c.id === comment.parentId) {
                return { ...c, replies: [...c.replies, comment] }
              }
              return c
            })
          }
          return [...prev, comment]
        })
      }
    })
    const unsubVote = on("vote_update", ({ postId: pId, yeahs }: { postId: string; yeahs: number }) => {
      if (pId === postId) setPost((prev) => (prev ? { ...prev, yeahs } : prev))
    })
    return () => {
      unsubComment()
      unsubVote()
    }
  }, [connected, on, postId, post])

  async function handleVote() {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
      setPost((prev) => (prev ? { ...prev, yeahs: prev.yeahs + 1 } : prev))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleShare(target: ShareTarget) {
    if (!post) return
    try {
      await shareContent({ type: "post", id: post.id, text: post.text || undefined }, target)
    } catch (err) {
      console.error("Share failed:", err)
    }
  }

  async function handleSubmitComment() {
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await apiPost(`/api/posts/${postId}/comments`, {
        text: commentText,
        parentId: replyingTo?.id || null,
      })
      setCommentText("")
      setReplyingTo(null)
      loadComments()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">Loading...</p>
  if (error) return <p role="alert" className="text-center text-white/40 mt-10">{error}</p>
  if (!post) return <p className="text-center text-white/40 mt-10">Post not found.</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-32">
      <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-white/60 hover:text-white">
          ← Back
        </button>
      </div>

      <div className="card m-4 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} aria-label={`View ${post.user.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
            <Avatar emoji={post.user.avatarEmoji} size={40} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} aria-label={`View ${post.user.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
                {post.user.ghostId}
              </Link>
              {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
            </div>
            <span className="text-xs text-white/40">{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        {post.text && <p className="text-white/90 mb-3 whitespace-pre-wrap leading-relaxed">{post.text}</p>}
        {post.imageUrl && (
          <div className="relative w-full h-72 mb-3 rounded-xl overflow-hidden bg-white/5 border border-white/10">
            <OptimizedImage
              src={post.imageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              rounded
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-5 text-sm border-t border-white/10 mt-2 pt-3">
          <button onClick={handleVote} aria-label={`Add heat, ${post.yeahs} heat`} className="inline-flex items-center gap-1 text-orange-200 hover:text-orange-100 focus-visible:outline-[#baff39]">🔥 {post.yeahs}</button>
          <span aria-label={`${post.commentsCount} comments`} className="inline-flex items-center gap-1 text-sky-200">💬 {post.commentsCount}</span>
          <ShareButton postId={post.id} postText={post.text || undefined} />
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-sm font-semibold text-white/60 mb-2">Comments</h3>
        {comments.length === 0 ? (
          <p className="text-white/30 text-sm">No comments yet — start the thread.</p>
        ) : (
          comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              onReply={(id, ghostId) => setReplyingTo({ id, ghostId })}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 p-3 max-w-lg mx-auto">
        {replyingTo && (
          <div className="flex items-center justify-between text-xs text-white/50 mb-2 px-1">
            <span>Replying to {replyingTo.ghostId}</span>
            <button onClick={() => setReplyingTo(null)}>✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
          />
          <button
            className="btn-primary px-4"
            onClick={handleSubmitComment}
            disabled={submitting || !commentText.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  )
}
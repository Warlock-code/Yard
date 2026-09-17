"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"

type Comment = {
  id: string
  text: string
  ghostId: string
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
        <div className="avatar-circle text-sm w-8 h-8">👻</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.ghostId}</span>
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

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  return <PostDetail key={params.id} postId={params.id} />
}

function PostDetail({ postId }: { postId: string }) {
  const router = useRouter()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ id: string; ghostId: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
        const feedData = await apiGet(`/api/posts?mode=all`)
        if (!active) return
        const found = feedData.posts.find((p: Post) => p.id === postId)
        setPost(found || null)
        try {
          const data = await apiGet(`/api/posts/${postId}/comments`)
          if (active) setComments(data.comments)
        } catch (err) {
          console.error(err)
        }
      } catch (err: unknown) {
        if (active && err instanceof Error && err.message === "Not authenticated.") {
          router.push("/login")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPost()
    return () => { active = false }
  }, [postId, router])

  async function handleVote() {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
      setPost((prev) => (prev ? { ...prev, yeahs: prev.yeahs + 1 } : prev))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
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
          <div className="avatar-circle">{post.user.avatarEmoji}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{post.user.ghostId}</span>
              {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
            </div>
            <span className="text-xs text-white/40">{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        {post.text && <p className="text-white/90 mb-3 whitespace-pre-wrap leading-relaxed">{post.text}</p>}
        {post.imageUrl && <img src={post.imageUrl} className="rounded-lg mb-3 w-full" alt="" />}

        <div className="flex flex-wrap items-center gap-4 text-sm border-t border-white/10 mt-2 pt-3">
          <button onClick={handleVote} aria-label={`Add heat, ${post.yeahs} heat`} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-orange-400/10 px-3 font-semibold text-orange-200 hover:bg-orange-400/20 hover:text-orange-100 focus-visible:outline-[#baff39]">🔥 {post.yeahs}</button>
          <span aria-label={`${post.commentsCount} comments`} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-sky-400/10 px-3 font-semibold text-sky-200">💬 {post.commentsCount}</span>
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
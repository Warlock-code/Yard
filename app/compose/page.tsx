"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { apiGet, apiPost } from "@/lib/useApi"
import { useUploadThing } from "@/lib/uploadthing"
import { getProgramKey } from "@/lib/program"

type StorageQuota = {
  campus: string
  program: string | null
  storageUsed: number
  storageRemaining: number
}

const FALLBACK_SUGGESTED = ["#gossip", "#confession", "#meme", "#gist"] as const

export default function ComposePage() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<"school" | "program">("school")
  const [posting, setPosting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [quotaError, setQuotaError] = useState("")
  const hasProgram = !!getProgramKey(quota?.campus, quota?.program)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [trendingTags, setTrendingTags] = useState<string[]>([])

  const liveHashtags = useMemo(() => {
    if (!text) return []
    const matches = text.match(/#(\w+)/g)
    if (!matches) return []
    return [...new Set(matches.map((m) => m.toLowerCase()))]
  }, [text])

  const suggestedTags = useMemo(() => {
    if (trendingTags.length > 0) return trendingTags
    return [...FALLBACK_SUGGESTED]
  }, [trendingTags])

  const refreshQuota = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/auth/me")
      .then((data) => {
        if (!data.user) throw new Error("Sign in to check your storage.")
        if (!isCurrent()) return
        setQuota(data.user)
        setQuotaError("")
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return
        setQuota(null)
        setQuotaError(err instanceof Error ? err.message : "Could not load storage.")
      })
  }, [])

  useEffect(() => {
    let active = true
    refreshQuota(() => active)
    return () => { active = false }
  }, [refreshQuota])

  useEffect(() => {
    let active = true
    apiGet("/api/trending?type=hashtags&limit=8")
      .then((data: { hashtags?: { tag: string }[] }) => {
        if (!active) return
        const tags = (data.hashtags ?? []).map((h) => `#${h.tag.toLowerCase()}`)
        if (tags.length > 0) setTrendingTags(tags.slice(0, 8))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const insertHashtag = useCallback((tag: string) => {
    const normalized = tag.startsWith("#") ? tag : `#${tag}`
    const lower = normalized.toLowerCase()
    if (liveHashtags.includes(lower)) {
      textareaRef.current?.focus()
      return
    }
    const el = textareaRef.current
    if (el && typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      const start = el.selectionStart
      const end = el.selectionEnd
      const before = text.slice(0, start)
      const after = text.slice(end)
      const prefixSpace = before.length > 0 && !/\s$/.test(before) ? " " : ""
      const newText = `${before}${prefixSpace}${normalized} ${after}`
      setText(newText)
      requestAnimationFrame(() => {
        el.focus()
        const pos = before.length + prefixSpace.length + normalized.length + 1
        el.setSelectionRange(pos, pos)
      })
    } else {
      const needsSpace = text.length > 0 && !/\s$/.test(text)
      setText((prev) => `${prev}${needsSpace ? " " : ""}${normalized} `)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [liveHashtags, text])

  const { startUpload, isUploading } = useUploadThing("postImage", {
    onClientUploadComplete: async (res) => {
      const r: any = res?.[0]
      const url = r?.serverData?.url || r?.ufsUrl || r?.url
      if (url) setImage(url)
      else alert("Upload completed without an image URL. Check pending images in your lair.")
      await refreshQuota()
    },
    onUploadError: (err) => alert(`Upload failed: ${err.message}`),
  })

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || image || isUploading || removing || posting || !quota) return
    if (file.size > quota.storageRemaining * 1024 * 1024) {
      alert("Not enough storage for this image. Free up space in your lair or visit the shop.")
      return
    }
    startUpload([file])
  }

  async function handleRemoveImage() {
    if (!image || removing || posting || isUploading) return
    setRemoving(true)
    try {
      const res = await fetch("/api/storage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: image }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Could not remove image.")
      }
      setImage(null)
      await refreshQuota()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not remove image.")
    } finally {
      setRemoving(false)
    }
  }

  async function handlePost() {
    if (posting || isUploading || removing || (visibility === "program" && !hasProgram) || (!text.trim() && !image)) return
    setPosting(true)
    try {
      await apiPost("/api/posts", { text, imageUrl: image, type: "confession", visibility })
      router.push("/feed")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPosting(false)
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-lg">
          ✕
        </button>
        <button
          className="btn-primary px-5 py-1.5 text-sm"
          onClick={handlePost}
          disabled={posting || isUploading || removing || (visibility === "program" && !hasProgram) || (!text.trim() && !image)}
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>

      <div className="p-4 flex-1">
        <textarea
          ref={textareaRef}
          autoFocus
          className="w-full bg-transparent outline-none text-lg placeholder-white/30 resize-none"
          placeholder="What's the gist?"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <p className="mt-2 text-xs text-white/35">
          Use #hashtag to tag your post — e.g. #gist #confession #X
        </p>

        {liveHashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Detected hashtags">
            {liveHashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-[#baff39]/10 border border-[#baff39]/20 px-2.5 py-1 text-xs text-[#baff39]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Suggested hashtags">
          <span className="text-xs text-white/25 mr-0.5">Try:</span>
          {suggestedTags.map((tag) => {
            const lower = tag.toLowerCase()
            const isActive = liveHashtags.includes(lower)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => insertHashtag(tag)}
                disabled={isActive}
                title={isActive ? `${tag} already added` : `Insert ${tag}`}
                aria-label={`Insert ${tag}`}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  isActive
                    ? "border-[#baff39]/20 bg-[#baff39]/10 text-[#baff39] opacity-60 cursor-default"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>

        {image && (
          <div className="relative mt-4 w-full h-64 rounded-xl overflow-hidden bg-white/5 border border-white/10">
            <Image
              src={image}
              alt="preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
            />
            <button
              onClick={handleRemoveImage}
              disabled={removing || posting || isUploading}
              aria-label={removing ? "Removing image" : "Remove image"}
              className="absolute top-2 right-2 z-10 bg-black/80 border border-white/20 rounded-full w-7 h-7 text-sm disabled:opacity-40 grid place-items-center"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setVisibility("school")}
            className={`flex-1 text-xs py-2 rounded-full border ${
              visibility === "school" ? "border-[#baff39] text-[#baff39]" : "border-white/15 text-white/40"
            }`}
          >
            🏫 My School
          </button>
          <button
            onClick={() => setVisibility("program")}
            disabled={!hasProgram}
            title={!hasProgram ? "A program is required for program-only posts." : undefined}
            className={`flex-1 text-xs py-2 rounded-full border disabled:opacity-40 disabled:cursor-not-allowed ${
              visibility === "program" ? "border-[#baff39] text-[#baff39]" : "border-white/15 text-white/40"
            }`}
          >
            🎓 My Program only
          </button>
        </div>

        <div className="text-xs text-white/40" role="status">
          {quota ? (
            <p>{quota.storageUsed.toFixed(2)} MB used · {quota.storageRemaining.toFixed(2)} MB remaining</p>
          ) : quotaError ? (
            <p>{quotaError} <button className="text-[#baff39]" onClick={() => refreshQuota()}>Retry</button></p>
          ) : (
            <p>Loading storage...</p>
          )}
        </div>
        <label className={`btn-ghost inline-block ${image || isUploading || removing || posting || !quota || quota.storageRemaining <= 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
          {isUploading ? "Uploading..." : removing ? "Removing..." : image ? "Remove photo to add another" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
            disabled={!!image || isUploading || removing || posting || !quota || quota.storageRemaining <= 0}
          />
        </label>
      </div>
    </main>
  )
}

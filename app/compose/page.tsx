"use client"

import { useCallback, useEffect, useState } from "react"
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

  const { startUpload, isUploading } = useUploadThing("postImage", {
    onClientUploadComplete: async (res) => {
      const url = res?.[0]?.serverData?.url
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
          autoFocus
          className="w-full bg-transparent outline-none text-lg placeholder-white/30 resize-none"
          placeholder="What's the gist?"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {image && (
          <div className="relative mt-3 w-full max-h-80">
            <Image
              src={image}
              alt=""
              fill
              className="rounded-lg w-full h-full object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <button
              onClick={handleRemoveImage}
              disabled={removing || posting || isUploading}
              aria-label={removing ? "Removing image" : "Remove image"}
              className="absolute top-2 right-2 z-10 bg-black/70 rounded-full w-7 h-7 text-sm disabled:opacity-40"
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
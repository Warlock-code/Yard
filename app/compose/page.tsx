"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { useUploadThing } from "@/lib/uploadthing"

export default function ComposePage() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const { startUpload, isUploading } = useUploadThing("postImage", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) setImage(res[0].url)
    },
    onUploadError: (err) => alert(`Upload failed: ${err.message}`),
  })

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) startUpload([file])
  }

  async function handlePost() {
    if (!text.trim() && !image) return
    setPosting(true)
    try {
      await apiPost("/api/posts", { text, imageUrl: image, type: "confession" })
      router.push("/feed")
    } catch (err: any) {
      alert(err.message)
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
          disabled={posting || isUploading || (!text.trim() && !image)}
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
          <div className="relative mt-3">
            <img src={image} className="rounded-lg w-full max-h-80 object-cover" alt="" />
            <button
              onClick={() => setImage(null)}
              className="absolute top-2 right-2 bg-black/70 rounded-full w-7 h-7 text-sm"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10">
        <label className="btn-ghost cursor-pointer inline-block">
          {isUploading ? "Uploading..." : "📷 Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        </label>
      </div>
    </main>
  )
}
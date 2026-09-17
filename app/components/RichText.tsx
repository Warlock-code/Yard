"use client"

import Link from "next/link"

const MENTION_REGEX = /@([A-Za-z0-9_]{2,30})/g

export default function RichText({ text }: { text: string }) {
  const parts: (string | { handle: string })[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push({ handle: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <Link key={index} href={`/u/${part.handle}`} className="text-[#baff39]">
            @{part.handle}
          </Link>
        )
      )}
    </>
  )
}

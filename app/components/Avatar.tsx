"use client"

import OptimizedImage from "@/app/components/OptimizedImage"

interface AvatarProps {
  emoji: string
  imageUrl?: string
  size?: number
  className?: string
}

export default function Avatar({ emoji, imageUrl, size = 40, className = "" }: AvatarProps) {
  const style = { width: size, height: size }

  if (imageUrl) {
    return (
      <OptimizedImage
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        rounded
        className={className}
        priority={size >= 80}
      />
    )
  }

  return (
    <div
      className={`avatar-circle flex items-center justify-center ${className}`}
      style={style}
      aria-hidden="true"
    >
      {emoji}
    </div>
  )
}
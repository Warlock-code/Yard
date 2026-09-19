"use client"

import Image from "next/image"
import { useState } from "react"

const BLUR_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

interface OptimizedImageProps {
  src: string
  alt?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  className?: string
  rounded?: boolean
  unoptimized?: boolean
  onLoad?: () => void
  onError?: () => void
}

export default function OptimizedImage({
  src,
  alt = "",
  fill = false,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  className = "",
  rounded = true,
  unoptimized = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  const baseStyles = "object-cover transition-opacity duration-300"
  const roundedStyles = rounded ? "rounded-xl" : ""
  const fillStyles = fill ? "absolute inset-0" : ""
  const opacityStyles = isLoaded ? "opacity-100" : "opacity-0"

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 border border-white/10 ${roundedStyles} ${fillStyles} ${className}`}
        style={fill ? undefined : { width, height }}
        aria-hidden="true"
      >
        <span className="text-2xl" role="img" aria-label="Failed to load image">🖼️</span>
      </div>
    )
  }

  if (fill) {
    return (
      <div className={`relative overflow-hidden ${roundedStyles} ${className}`} style={{ width: "100%", aspectRatio: "16/9" }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`${baseStyles} ${opacityStyles}`}
          unoptimized={unoptimized}
          placeholder="blur"
          blurDataURL={BLUR_PLACEHOLDER}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${roundedStyles} ${className}`} style={{ width, height }}>
      <Image
        src={src}
        alt={alt}
        width={width!}
        height={height!}
        sizes={sizes}
        priority={priority}
        className={`${baseStyles} ${opacityStyles}`}
        unoptimized={unoptimized}
        placeholder={unoptimized ? undefined : "blur"}
        blurDataURL={unoptimized ? undefined : BLUR_PLACEHOLDER}
        loading={priority ? "eager" : "lazy"}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"
import { LEVEL_UNLOCK_DISPLAY } from "@/lib/levels"

export const HOW_TO_LEVEL_UP_COPY =
  "Earn XP by posting gists (+10), getting yeahs (+2), entering battles (+5), and keeping your streak alive (+5). Level up to unlock Rare, Epic, and Legendary cosmetics, Themes, and Identity items."

export default function HowToLevelUpButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/60 transition hover:border-primary/40 hover:text-primary ${className}`}
      >
        ℹ️ How to level up
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-to-level-up-title"
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative card max-h-[85vh] w-full max-w-sm overflow-y-auto border border-white/10 p-5 shadow-2xl animate-slide-up">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">status ladder</p>
                <h3 id="how-to-level-up-title" className="text-lg font-black">how to level up</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/50 transition hover:text-white"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <p className="text-sm leading-relaxed text-white/70">{HOW_TO_LEVEL_UP_COPY}</p>

            <div className="mt-4 space-y-1.5">
              {LEVEL_UNLOCK_DISPLAY.map((level) => (
                <div
                  key={level.level}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base">{level.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">Level {level.level} · {level.title}</p>
                      <p className="truncate text-[11px] text-white/40">{level.unlocks}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-primary">
                    {level.xp.toLocaleString()} XP
                  </span>
                </div>
              ))}
            </div>

            <button className="btn-primary mt-4 w-full text-sm" onClick={() => setOpen(false)}>
              got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}

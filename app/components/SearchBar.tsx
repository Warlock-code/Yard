"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

interface SearchBarProps {
  placeholder?: string
  showFilters?: boolean
  initialQuery?: string
  campus?: string
  onSearch?: (query: string) => void
  className?: string
}

const RECENT_KEY = "yard-recent-searches"
const MAX_RECENT = 6

// Yard-original trending hints — static so SearchBar never touches app/api/*.
const TRENDING_YARD = [
  "#yardafterdark",
  "#freshdrip",
  "#battlenight",
  "ghost stories",
  "campus tea",
]

type Selectable = { kind: "suggestion" | "recent" | "trending"; value: string }

export default function SearchBar({
  placeholder = "Search the yard, ghosts, #tags…",
  showFilters = false,
  initialQuery = "",
  campus,
  onSearch,
  className = "",
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery || searchParams.get("q") || "")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recent, setRecent] = useState<string[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent haunts from this device only.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setRecent(parsed.filter((v) => typeof v === "string").slice(0, MAX_RECENT))
      }
    } catch {
      setRecent([])
    }
  }, [])

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q.trim() || q.length < 2) {
        setSuggestions([])
        return
      }

      setLoadingSuggestions(true)
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&campus=${campus || ""}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
        }
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    },
    [campus]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  // Reset keyboard cursor whenever the option set changes.
  useEffect(() => {
    setActiveIndex(-1)
  }, [query, suggestions, recent])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const trimmed = query.trim()
  const hasQuery = trimmed.length >= 2

  // Flat keyboard-navigable option list.
  const selectable: Selectable[] = hasQuery
    ? suggestions.map((s) => ({ kind: "suggestion" as const, value: s }))
    : [
        ...recent.map((r) => ({ kind: "recent" as const, value: r })),
        ...TRENDING_YARD.filter((t) => !recent.includes(t)).map((t) => ({
          kind: "trending" as const,
          value: t,
        })),
      ]

  function persistRecent(value: string) {
    const v = value.trim()
    if (!v) return
    setRecent((prev) => {
      const next = [v, ...prev.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        // Private mode etc. — recents just won't persist.
      }
      return next
    })
  }

  function commitSearch(value: string) {
    const v = value.trim()
    if (!v) return
    persistRecent(v)
    setShowSuggestions(false)
    setActiveIndex(-1)

    if (onSearch) {
      onSearch(v)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set("q", v)
      params.set("tab", "posts")
      params.delete("page")
      router.push(`/search?${params.toString()}`)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (activeIndex >= 0 && selectable[activeIndex]) {
      commitSearch(selectable[activeIndex].value)
      return
    }
    if (!trimmed) return
    commitSearch(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!showSuggestions) setShowSuggestions(true)
      if (selectable.length === 0) return
      setActiveIndex((prev) => (prev + 1) % selectable.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!showSuggestions) setShowSuggestions(true)
      if (selectable.length === 0) return
      setActiveIndex((prev) => (prev <= 0 ? selectable.length - 1 : prev - 1))
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && selectable[activeIndex] && showSuggestions) {
        e.preventDefault()
        commitSearch(selectable[activeIndex].value)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setShowSuggestions(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
    }
  }

  function handleFocus() {
    // Yard behavior: focused empty input reveals recent haunts + what's hot
    // in the yard; query >= 2 reveals live ghost matches.
    setShowSuggestions(true)
  }

  function handleBlur() {
    // Delayed so pointer/keyboard selection still lands.
    setTimeout(() => setShowSuggestions(false), 150)
  }

  function clearRecents() {
    setRecent([])
    try {
      window.localStorage.removeItem(RECENT_KEY)
    } catch {
      // ignore
    }
    inputRef.current?.focus()
  }

  const showDropdown = showSuggestions
  const activeId = activeIndex >= 0 ? `search-opt-${activeIndex}` : undefined
  let flatCursor = -1

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <form onSubmit={handleSubmit} role="search" className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#baff39]/50 focus:bg-white/10 transition-all"
          autoComplete="off"
          aria-label="Search the yard"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setSuggestions([])
              setActiveIndex(-1)
              setShowSuggestions(true)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </form>

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="search-dropdown absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]/95 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-md z-50"
        >
          {hasQuery ? (
            loadingSuggestions ? (
              <div className="px-4 py-3" aria-hidden="true">
                <p className="text-xs font-medium text-white/40 mb-2">Summoning ghosts…</p>
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-9 rounded-xl" />
                  <div className="skeleton-shimmer h-9 rounded-xl" />
                  <div className="skeleton-shimmer h-9 rounded-xl" />
                </div>
                <span className="sr-only">Loading suggestions</span>
              </div>
            ) : suggestions.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto py-1.5">
                {suggestions.map((suggestion, i) => {
                  flatCursor += 1
                  const idx = flatCursor
                  const isActive = idx === activeIndex
                  return (
                    <li key={suggestion} role="option" id={`search-opt-${idx}`} aria-selected={isActive}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => commitSearch(suggestion)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full px-4 py-2.5 text-left text-sm text-white/90 flex items-center gap-2.5 transition-colors ${
                          isActive ? "bg-[#baff39]/15 text-white" : "hover:bg-white/5"
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="shrink-0 text-white/40"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <span className="truncate">{suggestion}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-4 py-5 text-center">
                <p className="text-2xl" aria-hidden="true">👻</p>
                <p className="mt-1 text-sm font-semibold text-white/90">
                  No ghosts haunting &ldquo;{trimmed}&rdquo; yet
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  Be the first to yap about it in the yard — press Enter to post the search.
                </p>
              </div>
            )
          ) : (
            <div className="max-h-80 overflow-y-auto py-2">
              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-4 pt-1 pb-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">
                      Recent haunts
                    </p>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearRecents}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white/40 hover:text-[#baff39] hover:bg-[#baff39]/10 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <ul>
                    {recent.map((r) => {
                      flatCursor += 1
                      const idx = flatCursor
                      const isActive = idx === activeIndex
                      return (
                        <li key={`recent-${r}`} role="option" id={`search-opt-${idx}`} aria-selected={isActive}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => commitSearch(r)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`w-full px-4 py-2.5 text-left text-sm text-white/85 flex items-center gap-2.5 transition-colors ${
                              isActive ? "bg-[#baff39]/15 text-white" : "hover:bg-white/5"
                            }`}
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="shrink-0 text-white/35"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" />
                            </svg>
                            <span className="truncate">{r}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div className={recent.length > 0 ? "mt-1 border-t border-white/5 pt-2" : ""}>
                <p className="px-4 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">
                  <span aria-hidden="true">📈</span> Hot in the yard
                </p>
                <ul>
                  {TRENDING_YARD.filter((t) => !recent.includes(t)).map((t) => {
                    flatCursor += 1
                    const idx = flatCursor
                    const isActive = idx === activeIndex
                    return (
                      <li key={`trending-${t}`} role="option" id={`search-opt-${idx}`} aria-selected={isActive}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => commitSearch(t)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors ${
                            isActive ? "bg-[#baff39]/15 text-white" : "text-white/85 hover:bg-white/5"
                          }`}
                        >
                          <span aria-hidden="true" className="text-sm leading-none">📈</span>
                          <span className="truncate font-medium">{t}</span>
                          <span className="ml-auto shrink-0 rounded-full border border-[#baff39]/20 bg-[#baff39]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#baff39]">
                            yard hot
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {recent.length === 0 && (
                  <p className="px-4 pb-3 pt-1 text-xs text-white/35">
                    The yard is quiet… tap something hot or start haunting your own keyword. 👻
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-white/30">
            ↑↓ to drift through ghosts · Enter to haunt · Esc to vanish
          </p>
        </div>
      )}

      {showFilters && (
        <Link
          href="/search"
          className="absolute right-0 top-1/2 -translate-y-1/2 mr-10 text-white/50 hover:text-white/80 text-sm font-medium"
        >
          Filters
        </Link>
      )}
    </div>
  )
}

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

export default function SearchBar({
  placeholder = "Search posts, ghosts, hashtags...",
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
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
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
  }, [campus])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setShowSuggestions(false)

    if (onSearch) {
      onSearch(trimmed)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set("q", trimmed)
      params.set("tab", "posts")
      params.delete("page")
      router.push(`/search?${params.toString()}`)
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion)
    setShowSuggestions(false)

    if (onSearch) {
      onSearch(suggestion)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set("q", suggestion)
      params.set("tab", "posts")
      params.delete("page")
      router.push(`/search?${params.toString()}`)
    }
  }

  function handleFocus() {
    if (query.trim().length >= 2) {
      setShowSuggestions(true)
    }
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 200)
  }

  return (
    <div className={`relative ${className}`} ref={inputRef}>
      <form onSubmit={handleSubmit} className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
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
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#baff39]/50 focus:bg-white/10 transition-all"
          autoComplete="off"
          aria-label="Search"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls="search-suggestions"
          role="combobox"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-black/95 backdrop-blur border border-white/10 rounded-xl overflow-hidden shadow-xl z-50"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion} role="option">
              <button
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-2.5 text-left text-white/90 hover:bg-white/5 flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span>{suggestion}</span>
              </button>
            </li>
          ))}
        </ul>
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
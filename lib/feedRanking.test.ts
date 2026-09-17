import { test } from "node:test"
import assert from "node:assert/strict"
import { rankFeedCandidates } from "./feedRanking.ts"

const viewer = {
  campus: "KNUST",
  programKey: "CS-2024",
  followingIds: new Set(["u1"]),
}

function minutesAgo(snapshot: Date, minutes: number) {
  return new Date(snapshot.getTime() - minutes * 60_000)
}

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: "p",
    userId: "u",
    campus: "KNUST",
    programKey: null,
    yeahs: 0,
    commentsCount: 0,
    createdAt: new Date(0),
    ...overrides,
  }
}

const snapshot = new Date("2026-09-17T12:00:00Z")

test("orders by engagement-weighted recency, not insertion order", () => {
  const ranked = rankFeedCandidates([
    post({ id: "cold", createdAt: minutesAgo(snapshot, 1440), yeahs: 2 }),
    post({ id: "hot", createdAt: minutesAgo(snapshot, 30), yeahs: 50, commentsCount: 10 }),
    post({ id: "fresh", createdAt: minutesAgo(snapshot, 10) }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["hot", "fresh", "cold"])
})

test("boosts followed authors and same-program posts", () => {
  const ranked = rankFeedCandidates([
    post({ id: "stranger", createdAt: minutesAgo(snapshot, 10), yeahs: 5 }),
    post({ id: "friend", userId: "u1", createdAt: minutesAgo(snapshot, 60), yeahs: 5 }),
    post({ id: "classmate", programKey: "CS-2024", createdAt: minutesAgo(snapshot, 60), yeahs: 5 }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["friend", "classmate", "stranger"])
})

test("is deterministic and stable across repeated calls", () => {
  const candidates = [
    post({ id: "b", createdAt: minutesAgo(snapshot, 30) }),
    post({ id: "a", createdAt: minutesAgo(snapshot, 30) }),
  ]
  const first = rankFeedCandidates(candidates, viewer, snapshot)
  const second = rankFeedCandidates(candidates, viewer, snapshot)
  assert.deepEqual(first, second)
  assert.deepEqual(first.map((p) => p.id), ["a", "b"])
})

test("excludes posts newer than the snapshot timestamp", () => {
  const ranked = rankFeedCandidates([
    post({ id: "future", createdAt: new Date(snapshot.getTime() + 1000) }),
    post({ id: "past", createdAt: minutesAgo(snapshot, 1) }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["past"])
})

test("handles empty candidate list", () => {
  assert.deepEqual(rankFeedCandidates([], viewer, snapshot), [])
})

test("does not mutate input array", () => {
  const candidates = [post({ id: "x" }), post({ id: "y", yeahs: 3 })]
  const before = [...candidates]
  rankFeedCandidates(candidates, viewer, snapshot)
  assert.deepEqual(candidates, before)
})

test("rejects invalid timestamps", () => {
  assert.throws(() => rankFeedCandidates([post({ id: "x" })], viewer, new Date("nope")), RangeError)
  assert.throws(() => rankFeedCandidates([post({ id: "x", createdAt: new Date("nope") })], viewer, snapshot), RangeError)
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { capAuthorRepetition, rankFeedCandidates } from "./feedRanking.ts"

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

test("tie seed is stable within a session and only permutes ties", () => {
  const tied = [
    post({ id: "a", createdAt: minutesAgo(snapshot, 30) }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 30) }),
  ]
  const first = rankFeedCandidates(tied, viewer, snapshot, "seed-1").map((p) => p.id)
  const again = rankFeedCandidates(tied, viewer, snapshot, "seed-1").map((p) => p.id)
  assert.deepEqual(first, again)
  assert.deepEqual([...first].sort(), ["a", "b"])
})

test("tie seed rotates exact ties across refreshes", () => {
  const tied = [
    post({ id: "a", createdAt: minutesAgo(snapshot, 30) }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 30) }),
  ]
  const orders = new Set(
    Array.from({ length: 50 }, (_, i) =>
      rankFeedCandidates(tied, viewer, snapshot, `refresh-${i}`).map((p) => p.id).join(",")
    )
  )
  assert.ok(orders.size > 1, "expected ties to rotate across seeds")
})

test("tie seed rotates near-ties (same engagement, 1 min age gap)", () => {
  const nearTied = [
    post({ id: "a", createdAt: minutesAgo(snapshot, 30), yeahs: 5 }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 31), yeahs: 5 }),
  ]
  const orders = new Set(
    Array.from({ length: 50 }, (_, i) =>
      rankFeedCandidates(nearTied, viewer, snapshot, `refresh-${i}`).map((p) => p.id).join(",")
    )
  )
  assert.ok(orders.size > 1, "expected near-ties to rotate across seeds")
})

test("tie seed rotates boosted posts among themselves", () => {
  const boostedPair = [
    post({ id: "a", createdAt: minutesAgo(snapshot, 30), yeahs: 5, boostedUntil: new Date(snapshot.getTime() + 3_600_000) }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 31), yeahs: 5, boostedUntil: new Date(snapshot.getTime() + 3_600_000) }),
  ]
  const orders = new Set(
    Array.from({ length: 50 }, (_, i) =>
      rankFeedCandidates(boostedPair, viewer, snapshot, `refresh-${i}`).map((p) => p.id).join(",")
    )
  )
  assert.ok(orders.size > 1, "expected boosted near-ties to rotate across seeds")
})

test("tie seed never overrides real score gaps", () => {
  const ranked = rankFeedCandidates([
    post({ id: "cold", createdAt: minutesAgo(snapshot, 1440), yeahs: 2 }),
    post({ id: "hot", createdAt: minutesAgo(snapshot, 30), yeahs: 50, commentsCount: 10 }),
  ], viewer, snapshot, "any-seed")
  assert.deepEqual(ranked.map((p) => p.id), ["hot", "cold"])
})

test("reply velocity lifts fresh conversation above stale totals", () => {
  const ranked = rankFeedCandidates([
    post({ id: "stale", createdAt: minutesAgo(snapshot, 300), yeahs: 20, commentsCount: 20 }),
    post({ id: "live", createdAt: minutesAgo(snapshot, 300), yeahs: 20, commentsCount: 20, recentCommentsCount: 8 }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["live", "stale"])
})

test("missing velocity fields behave exactly as before", () => {
  const ranked = rankFeedCandidates([
    post({ id: "a", createdAt: minutesAgo(snapshot, 30), yeahs: 5 }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 60), yeahs: 5 }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["a", "b"])
})

test("rage-bait (votes, no replies, old) sinks below discussion", () => {
  const ranked = rankFeedCandidates([
    post({ id: "bait", createdAt: minutesAgo(snapshot, 420), yeahs: 40, commentsCount: 0 }),
    post({ id: "talk", createdAt: minutesAgo(snapshot, 420), yeahs: 12, commentsCount: 8 }),
  ], viewer, snapshot)
  assert.deepEqual(ranked.map((p) => p.id), ["talk", "bait"])
})

test("fresh hot takes are spared from rage-bait decay", () => {
  const ranked = rankFeedCandidates([
    post({ id: "fresh-take", createdAt: minutesAgo(snapshot, 60), yeahs: 40, commentsCount: 0 }),
    post({ id: "older", createdAt: minutesAgo(snapshot, 400), yeahs: 5, commentsCount: 1 }),
  ], viewer, snapshot)
  assert.equal(ranked[0].id, "fresh-take")
})

test("open reports mildly dampen but don't veto", () => {
  const clean = rankFeedCandidates([
    post({ id: "a", createdAt: minutesAgo(snapshot, 60), yeahs: 10, commentsCount: 3 }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 60), yeahs: 10, commentsCount: 3 }),
  ], viewer, snapshot).map((p) => p.id)
  const flagged = rankFeedCandidates([
    post({ id: "a", createdAt: minutesAgo(snapshot, 60), yeahs: 10, commentsCount: 3, reportsCount: 5 }),
    post({ id: "b", createdAt: minutesAgo(snapshot, 60), yeahs: 10, commentsCount: 3 }),
  ], viewer, snapshot).map((p) => p.id)
  assert.deepEqual(clean, ["a", "b"])
  assert.deepEqual(flagged, ["b", "a"])
})

test("capAuthorRepetition limits one author in the top window", () => {
  const ranked = [
    post({ id: "s1", userId: "spammer" }),
    post({ id: "s2", userId: "spammer" }),
    post({ id: "s3", userId: "spammer" }),
    post({ id: "other", userId: "u2" }),
  ]
  const capped = capAuthorRepetition(ranked, 2, 20)
  assert.deepEqual(capped.map((p) => p.id), ["s1", "s2", "other", "s3"])
})

test("capAuthorRepetition is a no-op without repetition", () => {
  const ranked = [post({ id: "a", userId: "u1" }), post({ id: "b", userId: "u2" })]
  assert.deepEqual(capAuthorRepetition(ranked).map((p) => p.id), ["a", "b"])
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { canReadPost, getProgramKey, normalizeProgram } from "./program.ts"

const viewer = { campus: "KNUST", program: "BSc Computer Science" }
const key = getProgramKey(viewer.campus, viewer.program)

test("normalizeProgram lowercases, trims, and collapses whitespace", () => {
  assert.equal(normalizeProgram("  BSc   Computer  Science \n"), "bsc computer science")
  assert.equal(normalizeProgram("\t\t"), null)
  assert.equal(normalizeProgram(42), null)
  assert.equal(normalizeProgram(null), null)
})

test("getProgramKey composes campus+program and is order independent", () => {
  assert.equal(key, JSON.stringify(["knust", "bsc computer science"]))
  assert.equal(getProgramKey("KNUST", "BSc Computer Science"), key)
})

test("getProgramKey ignores program level variants and never builds a key without both parts", () => {
  assert.notEqual(getProgramKey("KNUST", "LEVEL 200"), key)
  assert.equal(getProgramKey("KNUST", null), null)
  assert.equal(getProgramKey(null, "CS"), null)
})

test("getProgramKey never equates two missing programs", () => {
  assert.equal(getProgramKey("KNUST", undefined), getProgramKey("UG", undefined))
})

test("program visibility requires exact campus and program match", () => {
  const post = { campus: "KNUST", program: "BSc Computer Science", visibility: "program", archived: false }
  assert.equal(canReadPost(viewer, post), true)
  assert.equal(canReadPost(viewer, { ...post, program: "BSc Mathematics" }), false)
  assert.equal(canReadPost(viewer, { ...post, campus: "KNUST CITY" }), false)
  assert.equal(canReadPost(viewer, { ...post, visibility: "school" }), true)
  assert.equal(canReadPost(viewer, { ...post, archived: true }), false)
})

test("program posts are unreadable for viewers without a program", () => {
  assert.equal(
    canReadPost({ campus: "KNUST", program: null }, {
      campus: "KNUST",
      program: "BSc Computer Science",
      visibility: "program",
      archived: false,
    }),
    false,
  )
})

test("legacy posts fall back to the stored snapshot when programKey is missing", () => {
  const legacy = { campus: "KNUST", program: "BSc Computer Science", visibility: "program", archived: false }
  assert.equal(canReadPost(viewer, legacy), true)
  assert.equal(
    canReadPost(viewer, {
      campus: "KNUST",
      program: "BSc Computer Science",
      programKey: key,
      visibility: "program",
      archived: false,
    }),
    true,
  )
})

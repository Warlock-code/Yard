import { test } from "node:test"
import assert from "node:assert/strict"
import { getProgramKey, programPostWhere, readablePostWhere } from "./program.ts"

const viewer = { campus: "KNUST", program: "BSc Computer Science" }
const key = getProgramKey(viewer.campus, viewer.program)

test("programPostWhere matches canonical key and normalized legacy strings", () => {
  const where = programPostWhere(viewer, ["Bsc   computer science", "bsc computer science", "BSc Mathematics"])
  assert.deepEqual(where.OR, [
    { programKey: key },
    {
      AND: [
        { OR: [{ programKey: null }, { programKey: "" }] },
        { program: { in: ["Bsc   computer science", "bsc computer science"] } },
      ],
    },
  ])
})

test("programPostWhere never matches when the viewer has no program", () => {
  assert.deepEqual(programPostWhere({ campus: "KNUST" }, ["Anything"]), { id: { in: [] } })
  assert.deepEqual(programPostWhere({ campus: "KNUST", program: "  " }, ["Anything"]), { id: { in: [] } })
})

test("programPostWhere never matches legacy strings that normalize elsewhere", () => {
  const where = programPostWhere(viewer, ["Level 200", "Computer Science"])
  const legacy = where.OR![1] as { AND: unknown[] }
  assert.deepEqual(legacy.AND[1], { program: { in: [] } })
})

test("readablePostWhere allows school posts plus authorized program posts", () => {
  const where = readablePostWhere(viewer, ["Bsc   computer science"])
  assert.deepEqual(where.OR, [
    { visibility: "school" },
    { AND: [{ visibility: "program" }, programPostWhere(viewer, ["Bsc   computer science"])] },
  ])
  assert.equal(where.archived, false)
})

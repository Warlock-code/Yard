import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"

const prisma = new PrismaClient()
const campus = "GCTU"
const seedEmailSuffix = "@seed.yardapp.me"
const defaultProgram = "General Studies"
const defaultLevel = "level 200"
const limit = Math.max(500, Number.parseInt(process.argv[2] || "500", 10) || 500)
const chunkFiles = [
  "gctu-chunk-A.json",
  "gctu-chunk-B.json",
  "gctu-chunk-C.json",
  "gctu-chunk-D.json",
  "gctu-chunk-E.json",
  "gctu-chunk-F.json",
  "gctu-chunk-G.json",
  "gctu-chunk-H.json",
  "gctu-chunk-I.json",
  "gctu-chunk-J.json",
]

function loadPosts() {
  const posts = []
  for (const file of chunkFiles) {
    const data = JSON.parse(readFileSync(join(process.cwd(), file), "utf8"))
    posts.push(...data)
  }
  if (posts.length < limit) throw new Error(`only ${posts.length} seed posts are available`)
  return posts.slice(0, limit)
}

function ghostEmail(ghostId) {
  return `${ghostId.toLowerCase()}${seedEmailSuffix}`
}

function postId(index) {
  return `seed_gctu_conversation_${index + 1}`
}

function commentId(index, commentIndex) {
  return `seed_gctu_comment_${index + 1}_${commentIndex + 1}`
}

function createdAt(index) {
  const ageMinutes = 20 + ((index * 137) % (21 * 24 * 60))
  return new Date(Date.now() - ageMinutes * 60 * 1000)
}

function tagsFromText(text) {
  return [...new Set([...String(text || "").matchAll(/#(\w+)/g)].map((match) => match[1].toLowerCase()))]
}

function voteCount(post, index, userCount) {
  const sourceLikes = Number.isFinite(post.yeahs) ? Math.max(0, post.yeahs) : 0
  const cap = Math.max(1, userCount - 1)
  const naturalVariation = 8 + ((index * 17) % 73)
  return Math.min(cap, Math.max(3, Math.min(sourceLikes || naturalVariation, naturalVariation + 35)))
}

async function ensureUsers(posts) {
  const ghostMap = new Map()
  for (const post of posts) {
    if (post.authorGhost) ghostMap.set(post.authorGhost, post.authorAvatar || "👻")
    for (const comment of post.comments || []) {
      if (comment.ghostId) ghostMap.set(comment.ghostId, comment.avatarEmoji || "👻")
    }
  }

  const entries = [...ghostMap.entries()]
  for (let start = 0; start < entries.length; start += 6) {
    const batch = entries.slice(start, start + 6)
    await Promise.all(batch.map(([ghostId, avatarEmoji]) => prisma.user.upsert({
      where: { email: ghostEmail(ghostId) },
      update: { campus, avatarEmoji },
      create: {
        email: ghostEmail(ghostId),
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus,
        programLevel: defaultLevel,
        program: defaultProgram,
        ghostId,
        avatarEmoji,
      },
    })))
    if (start % 120 === 0) console.log(`prepared ${Math.min(start + batch.length, entries.length)}/${entries.length} seed ghosts`)
  }

  const users = await prisma.user.findMany({
    where: { email: { endsWith: seedEmailSuffix }, campus },
    orderBy: { ghostId: "asc" },
  })
  return { users, byGhost: new Map(users.map((user) => [user.ghostId, user])) }
}

async function seedPost(post, index, users, byGhost) {
  const author = byGhost.get(post.authorGhost)
  if (!author) return { comments: 0, votes: 0 }

  const id = postId(index)
  const at = createdAt(index)
  const text = String(post.text || "").trim()
  const type = ["confession", "gossip", "meme"].includes(post.type) ? post.type : "confession"

  const previousComments = await prisma.comment.findMany({ where: { postId: id }, select: { id: true } })
  const previousCommentIds = previousComments.map((comment) => comment.id)
  await prisma.commentVote.deleteMany({ where: { commentId: { in: previousCommentIds } } })
  await prisma.comment.deleteMany({ where: { postId: id } })
  await prisma.postVote.deleteMany({ where: { postId: id } })
  await prisma.postHashtag.deleteMany({ where: { postId: id } })

  const seededPost = await prisma.post.upsert({
    where: { id },
    update: {
      userId: author.id,
      text,
      type,
      campus,
      program: defaultProgram,
      programLevel: defaultLevel,
      visibility: "school",
      archived: false,
      boosted: !!post.boosted,
      boostedUntil: post.boosted ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      createdAt: at,
      commentsCount: 0,
      yeahs: 0,
    },
    create: {
      id,
      userId: author.id,
      text,
      type,
      campus,
      program: defaultProgram,
      programLevel: defaultLevel,
      visibility: "school",
      boosted: !!post.boosted,
      boostedUntil: post.boosted ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      createdAt: at,
    },
  })

  const tags = tagsFromText(text)
  for (const tag of tags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      update: { campus, lastUsedAt: new Date() },
      create: { tag, campus, postsCount: 0 },
    })
    await prisma.postHashtag.create({ data: { postId: seededPost.id, hashtagId: hashtag.id } })
  }

  const voters = users.filter((user) => user.id !== author.id)
  const comments = (post.comments || []).filter((comment) => byGhost.has(comment.ghostId))
  const commentRows = comments.map((comment, commentIndex) => ({
    id: commentId(index, commentIndex),
    postId: seededPost.id,
    userId: byGhost.get(comment.ghostId).id,
    ghostId: comment.ghostId,
    text: String(comment.text || "").trim(),
    parentId: commentIndex > 1 && commentIndex % 3 === 0 ? commentId(index, commentIndex - 1) : null,
    yeahs: Math.min(voters.length, 2 + ((index + commentIndex * 3) % 9)),
    createdAt: new Date(at.getTime() + Math.min(commentIndex * 11, 240) * 60 * 1000),
  }))
  if (commentRows.length) await prisma.comment.createMany({ data: commentRows })

  const likes = voteCount(post, index, users.length)
  const postVotes = voters.slice(0, likes).map((user, voteIndex) => ({
    postId: seededPost.id,
    userId: user.id,
    createdAt: new Date(at.getTime() + Math.min(voteIndex * 7, 180) * 60 * 1000),
  }))
  if (postVotes.length) await prisma.postVote.createMany({ data: postVotes, skipDuplicates: true })

  const commentVotes = []
  for (let commentIndex = 0; commentIndex < commentRows.length; commentIndex += 1) {
    const commentLikes = Math.min(voters.length, 2 + ((index + commentIndex * 3) % 9))
    for (const [voteIndex, user] of voters.slice(0, commentLikes).entries()) {
      commentVotes.push({
        commentId: commentRows[commentIndex].id,
        userId: user.id,
        createdAt: new Date(commentRows[commentIndex].createdAt.getTime() + voteIndex * 5 * 60 * 1000),
      })
    }
  }
  if (commentVotes.length) await prisma.commentVote.createMany({ data: commentVotes, skipDuplicates: true })

  await prisma.post.update({
    where: { id: seededPost.id },
    data: { commentsCount: commentRows.length, yeahs: postVotes.length },
  })

  return { comments: commentRows.length, votes: postVotes.length }
}

async function seedFollows(users) {
  const rows = []
  for (let index = 0; index < users.length; index += 1) {
    const follower = users[index]
    const first = users[(index + 1) % users.length]
    const second = users[(index + 7) % users.length]
    if (follower.id !== first.id) rows.push({ followerId: follower.id, followingId: first.id })
    if (follower.id !== second.id) rows.push({ followerId: follower.id, followingId: second.id })
  }
  if (rows.length) await prisma.follow.createMany({ data: rows, skipDuplicates: true })
}

async function refreshHashtagCounts(tags) {
  for (const tag of tags) {
    const hashtag = await prisma.hashtag.findUnique({ where: { tag }, select: { id: true } })
    if (!hashtag) continue
    const count = await prisma.postHashtag.count({ where: { hashtagId: hashtag.id } })
    await prisma.hashtag.update({ where: { id: hashtag.id }, data: { postsCount: count, trendingScore: count } })
  }
}

async function main() {
  const posts = loadPosts()
  const { users, byGhost } = await ensureUsers(posts)
  const usedTags = new Set()
  let totalComments = 0
  let totalVotes = 0

  for (const post of posts) for (const tag of tagsFromText(post.text)) usedTags.add(tag)
  for (let index = 0; index < posts.length; index += 1) {
    const result = await seedPost(posts[index], index, users, byGhost)
    totalComments += result.comments
    totalVotes += result.votes
    if ((index + 1) % 25 === 0) console.log(`seeded ${index + 1}/${posts.length} posts`)
  }
  await seedFollows(users)
  await refreshHashtagCounts(usedTags)
  console.log(`seeded ${posts.length} posts, ${totalComments} comments, ${totalVotes} post likes, and ${users.length * 2} follows`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())

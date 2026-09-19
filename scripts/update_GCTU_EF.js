import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const CONCURRENCY = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.log(`RETRY ${i + 1}/${tries} err=${e.code || e.message}`);
      // exponential backoff base 1.5s: 1.5s, 3s, 6s, 12s, 24s, 48s
      await sleep(1500 * Math.pow(2, i));
    }
  }
  throw last;
}

async function processPost(polished, userByGhost) {
  const authorGhost = polished.authorGhost;
  const author = userByGhost.get(authorGhost);
  if (!author) {
    console.log(`SKIP no author ${authorGhost}`);
    return { posts: 0, comments: 0 };
  }
  // Per spec: find target via findFirst orderBy createdAt asc; if multiple, update ALL (findMany)
  const first = await withRetry(() =>
    prisma.post.findFirst({
      where: { campus: "GCTU", user: { ghostId: authorGhost } },
      orderBy: { createdAt: "asc" },
    })
  );
  if (!first) {
    console.log(`SKIP no post found for ${authorGhost}`);
    return { posts: 0, comments: 0 };
  }
  const targets = await withRetry(() =>
    prisma.post.findMany({
      where: { campus: "GCTU", user: { ghostId: authorGhost } },
      orderBy: { createdAt: "asc" },
    })
  );
  if (targets.length > 1) {
    console.log(`DUPE author=${authorGhost} matches=${targets.length} ids=${targets.map((t) => t.id.slice(0, 8)).join(",")}`);
  }
  let posts = 0;
  let comments = 0;
  for (const target of targets) {
    // Update text only — do NOT touch yeahs, boosted, hashtags, createdAt
    await withRetry(() =>
      prisma.post.update({ where: { id: target.id }, data: { text: polished.text } })
    );
    await withRetry(() => prisma.comment.deleteMany({ where: { postId: target.id } }));
    const list = polished.comments || [];
    for (const c of list) {
      const u = userByGhost.get(c.ghostId) || author;
      await withRetry(() =>
        prisma.comment.create({
          data: { postId: target.id, userId: u.id, ghostId: u.ghostId, text: c.text },
        })
      );
    }
    // Keep commentsCount in sync (allowed — not in do-not-touch list)
    await withRetry(() =>
      prisma.post.update({ where: { id: target.id }, data: { commentsCount: list.length } })
    );
    posts += 1;
    comments += list.length;
  }
  return { posts, comments };
}

async function main() {
  const pairs = ["E", "F"];
  let all = [];
  for (const X of pairs) {
    const orig = JSON.parse(readFileSync(join(process.cwd(), `gctu-chunk-${X}.orig.json`), "utf-8"));
    const polished = JSON.parse(readFileSync(join(process.cwd(), `gctu-chunk-${X}.json`), "utf-8"));
    console.log(`CHUNK ${X}: orig=${orig.length} polished=${polished.length}`);
    if (orig.length !== 150 || polished.length !== 150) console.log(`WARN chunk ${X} expected 150 each`);
    for (let i = 0; i < Math.max(orig.length, polished.length); i++) {
      const o = orig[i];
      const p = polished[i];
      if (!o || !p || o.authorGhost !== p.authorGhost) {
        console.log(`WARN order mismatch chunk ${X} index ${i}: ${o?.authorGhost} vs ${p?.authorGhost}`);
      }
    }
    all.push(...polished);
  }
  console.log(`TOTAL polished posts to process (indices)=${all.length}`);

  const users = await withRetry(() =>
    prisma.user.findMany({ where: { email: { endsWith: "@seed.yardapp.me" }, campus: "GCTU" } })
  );
  const userByGhost = new Map(users.map((u) => [u.ghostId, u]));
  console.log(`USERS_READY=${userByGhost.size}`);

  let donePosts = 0;
  let doneComments = 0;
  let doneIndices = 0;
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const batch = all.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((p) => processPost(p, userByGhost)));
    for (const r of results) {
      donePosts += r.posts;
      doneComments += r.comments;
    }
    doneIndices += batch.length;
    if (doneIndices % 25 === 0 || doneIndices === all.length) {
      console.log(`PROGRESS indices=${doneIndices}/${all.length} posts=${donePosts} comments=${doneComments}`);
    }
    await sleep(400);
  }
  console.log(`DONE indices=${doneIndices} posts=${donePosts} comments=${doneComments}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

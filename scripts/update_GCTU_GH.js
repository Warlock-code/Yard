import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const CONCURRENCY = 2;
const PAIRS = [
  { orig: "gctu-chunk-G.orig.json", pol: "gctu-chunk-G.json" },
  { orig: "gctu-chunk-H.orig.json", pol: "gctu-chunk-H.json" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.log(`RETRY ${i + 1}/${tries} err=${e.code || e.message}`);
      // exponential backoff base 1.5s: 1.5s * 2^i
      await sleep(1500 * Math.pow(2, i));
    }
  }
  throw last;
}

async function main() {
  // 1. Load both pairs, verify same order 150 each, same authorGhost
  const entries = []; // { orig, pol, file }
  for (const { orig, pol } of PAIRS) {
    const origArr = JSON.parse(readFileSync(join(process.cwd(), orig), "utf-8"));
    const polArr = JSON.parse(readFileSync(join(process.cwd(), pol), "utf-8"));
    console.log(`${orig}: ${origArr.length}, ${pol}: ${polArr.length}`);
    if (origArr.length !== 150 || polArr.length !== 150) {
      throw new Error(`Length mismatch for ${orig}/${pol}: ${origArr.length}/${polArr.length}`);
    }
    for (let i = 0; i < origArr.length; i++) {
      if (origArr[i].authorGhost !== polArr[i].authorGhost) {
        throw new Error(`Order mismatch ${pol} index ${i}: ${origArr[i].authorGhost} !== ${polArr[i].authorGhost}`);
      }
      entries.push({ orig: origArr[i], pol: polArr[i], file: pol, index: i });
    }
  }
  console.log(`TOTAL_ENTRIES=${entries.length}`);

  // 2. Fetch all GCTU seed users into map
  const users = await withRetry(() =>
    prisma.user.findMany({
      where: { email: { endsWith: "@seed.yardapp.me" }, campus: "GCTU" },
    })
  );
  const userByGhost = new Map(users.map((u) => [u.ghostId, u]));
  console.log(`USERS_READY=${userByGhost.size}`);

  async function updateOne(entry) {
    const { pol } = entry;
    const authorGhost = pol.authorGhost;
    const author = userByGhost.get(authorGhost);
    if (!author) {
      console.log(`WARN no author user for ${authorGhost}`);
      return { posts: 0, comments: 0 };
    }
    const posts = await withRetry(() =>
      prisma.post.findMany({
        where: { campus: "GCTU", user: { ghostId: authorGhost } },
        select: { id: true, createdAt: true },
      })
    );
    if (posts.length === 0) {
      console.log(`WARN no posts found for ${authorGhost}`);
      return { posts: 0, comments: 0 };
    }
    let commentsTotal = 0;
    for (const p of posts) {
      // Update text ONLY — do NOT touch yeahs/boosted/hashtags/createdAt
      await withRetry(() =>
        prisma.post.update({ where: { id: p.id }, data: { text: pol.text } })
      );
      await withRetry(() => prisma.comment.deleteMany({ where: { postId: p.id } }));
      const now = new Date();
      const rows = (pol.comments || []).map((c, idx) => {
        const u = userByGhost.get(c.ghostId) || author;
        let at = new Date(p.createdAt.getTime() + (idx + 1) * 60 * 1000);
        if (at > now) {
          // keep order but stay <= now
          at = new Date(now.getTime() - (pol.comments.length - idx) * 1000);
        }
        return {
          postId: p.id,
          userId: u.id,
          ghostId: u.ghostId,
          text: c.text,
          createdAt: at,
        };
      });
      if (rows.length) {
        // create sequentially in order to guarantee ordering
        for (const row of rows) {
          await withRetry(() => prisma.comment.create({ data: row }));
        }
      }
      await withRetry(() =>
        prisma.post.update({ where: { id: p.id }, data: { commentsCount: rows.length } })
      );
      commentsTotal += rows.length;
    }
    await sleep(400);
    return { posts: posts.length, comments: commentsTotal };
  }

  let done = 0;
  let postsUpdated = 0;
  let commentsRecreated = 0;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((e) =>
        updateOne(e).catch((err) => {
          console.log(`SKIP ${e.pol.authorGhost} err=${err.code || err.message}`);
          return { posts: 0, comments: 0 };
        })
      )
    );
    for (const r of results) {
      postsUpdated += r.posts;
      commentsRecreated += r.comments;
    }
    done += batch.length;
    if (done % 25 === 0 || done === entries.length) {
      console.log(`PROGRESS ${done}/${entries.length} postsUpdated=${postsUpdated} comments=${commentsRecreated}`);
    }
  }
  console.log(`DONE entries=${done} postsUpdated=${postsUpdated} comments=${commentsRecreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

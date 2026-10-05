/**
 * Broadcast an "update the app" notification to all users.
 *
 * Usage:
 *   npx tsx scripts/notify-app-update.ts            # dry run: counts only, writes nothing
 *   npx tsx scripts/notify-app-update.ts --send     # sends for real (skips users already notified)
 *
 * What it does per user:
 *   - creates an in-app Notification row (type "app_update", href "/download")
 *   - sends push via existing transports (FCM / web-push) when a token exists
 *
 * Safety:
 *   - dry run by default; --send required to write anything
 *   - dedupes: users who already have this exact notification are skipped
 *   - batched (25 at a time) with a short pause to avoid hammering FCM/DB
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const VERSION = "v1.0.1";
const TITLE = `yard ${VERSION} is out — update your app`;
const BODY = `tap to get the new yard ${VERSION} apk with the latest fixes. download at yardapp.me/download`;
const HREF = "/download";
const TYPE = "app_update";
const BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const send = process.argv.includes("--send");

  const totalUsers = await prisma.user.count();
  const alreadyNotified = await prisma.notification.count({
    where: { type: TYPE, href: HREF, title: TITLE },
  });
  const tokens = await prisma.deviceToken.count();
  const usersWithPushToken = await prisma.user.count({
    where: { pushToken: { not: null } },
  });

  console.log(`users: ${totalUsers}`);
  console.log(`already notified (skipped): ${alreadyNotified}`);
  console.log(`device tokens stored: ${tokens}`);
  console.log(`users with pushToken: ${usersWithPushToken}`);

  if (!send) {
    console.log("dry run — nothing written. re-run with --send to broadcast.");
    return;
  }

  const notifiedIds = new Set(
    (
      await prisma.notification.findMany({
        where: { type: TYPE, href: HREF, title: TITLE },
        select: { userId: true },
      })
    ).map((n) => n.userId)
  );

  const ids = (
    await prisma.user.findMany({ select: { id: true } })
  ).map((u) => u.id);
  const pending = ids.filter((id) => !notifiedIds.has(id));
  console.log(`sending to ${pending.length} users in batches of ${BATCH_SIZE}...`);

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((userId) =>
        createNotification({ userId, type: TYPE, title: TITLE, body: BODY, href: HREF })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent += 1;
      else {
        failed += 1;
        console.error("notify failed:", r.reason instanceof Error ? r.reason.message : r.reason);
      }
    }
    console.log(`progress: ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} (sent ${sent}, failed ${failed})`);
    if (i + BATCH_SIZE < pending.length) await sleep(BATCH_PAUSE_MS);
  }

  console.log(`done. sent=${sent} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

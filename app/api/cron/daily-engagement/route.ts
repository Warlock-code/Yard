import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { battleCountdownText } from "@/lib/battle-countdown"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = Date.now()
  const results: Record<string, unknown> = {}

  // NOTE: battle finalization (/api/cron/battles, daily 00:00 UTC) and board
  // prizes (/api/cron/leaderboard, daily 00:05 UTC) run on their own Vercel
  // schedules and must stay standalone — this route no longer invokes them.
  // Their payouts are guarded, so each schedule owns its own work.
  // Vercel Hobby only permits daily cron expressions.

  // 1. Return reminder
  let sent = 0
  try {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        OR: [
          { lastPostedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
          { lastPostedAt: null },
        ],
        notifications: {
          none: {
            type: "return_reminder",
            createdAt: { gte: new Date(now - 48 * 60 * 60 * 1000) },
          },
        },
      },
      select: { id: true },
      take: 200,
    })

    // Send in bounded batches and await each batch. Fire-and-forget work can
    // be cut off when the serverless function returns, losing the push.
    const CHUNK = 10
    for (let i = 0; i < users.length; i += CHUNK) {
      const batch = users.slice(i, i + CHUNK)
      const results = await Promise.allSettled(
        batch.map((user) =>
          createNotification({
            userId: user.id,
            type: "return_reminder",
            title: "the yard misses you",
            body: "new gist dropped while you were away — check the feed.",
            href: "/feed",
          })
        )
      )
      sent += results.filter((r) => r.status === "fulfilled" && r.value).length
    }
  } catch {
    // ignore
  }

  results.returnReminder = { sent }

  // 2. Generate AI post
  try {
    const recent = await prisma.post.findMany({
      where: { text: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { text: true },
    })

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          {
            role: "system",
            content: "Write one short, anonymous Ghanaian university campus confession or joke post, under 200 characters, casual student tone. Never mention real people. Respond with only the post text, nothing else.",
          },
          { role: "user", content: `Style examples:\n${recent.map((r) => r.text).join("\n")}` },
        ],
      }),
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()

    if (text) {
      await prisma.aiDraft.create({ data: { text: text.toLowerCase() } })
      results.generatePost = { success: true, text }
    } else {
      results.generatePost = { success: false, reason: "No text generated" }
    }
  } catch (e) {
    results.generatePost = { success: false, error: String(e) }
  }

  // 3. Battle countdowns — one reminder per battle per day:
  //    UPCOMING -> "starts in N days", ACTIVE -> "ends in N days".
  //    Deduped per user per battle per day via the notification type.
  let countdownSent = 0
  try {
    const dayStart = new Date(now)
    dayStart.setUTCHours(0, 0, 0, 0)
    const prompts = await prisma.battlePrompt.findMany({
      where: {
        OR: [
          { status: "UPCOMING", startsAt: { gt: new Date(now) } },
          { status: "ACTIVE", endsAt: { gt: new Date(now) } },
        ],
      },
      select: { id: true, text: true, campus: true, status: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
      take: 10,
    })

    for (const prompt of prompts) {
      const copy = battleCountdownText({
        text: prompt.text,
        status: prompt.status,
        startsAt: prompt.startsAt,
        endsAt: prompt.endsAt,
        now: new Date(now),
      })
      if (!copy) continue
      const type = `battle_countdown:${prompt.id}`
      const recipients = await prisma.user.findMany({
        where: {
          campus: prompt.campus,
          notifications: {
            none: { type, createdAt: { gte: dayStart } },
          },
        },
        select: { id: true },
        take: 1000,
      })
      const CHUNK = 10
      for (let i = 0; i < recipients.length; i += CHUNK) {
        await Promise.allSettled(
          recipients.slice(i, i + CHUNK).map((u) =>
            createNotification({
              userId: u.id,
              type,
              title: copy.title,
              body: copy.body,
              href: "/battles",
            }).catch(() => null)
          )
        )
        countdownSent += Math.min(CHUNK, recipients.length - i)
      }
    }
  } catch {
    // ignore
  }

  results.battleCountdowns = { sent: countdownSent }

  // 4. Confession of the day — top post of the last 24h by yeahs is
  // featured 24h (isCOTD flag + cotdDate, rendered as a distinct card at
  // the top of the feed) + 500cr (PLUS/PRIME; FREE shadow). Stale flags
  // (>24h) are cleared first so only one COTD is ever live. Idempotent via
  // cotd:<postId> notifications.
  try {
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    await prisma.post.updateMany({
      where: { isCOTD: true, cotdDate: { lt: dayAgo } },
      data: { isCOTD: false },
    }).catch(() => {})
    const top = await prisma.post.findFirst({
      where: { createdAt: { gte: dayAgo }, archived: false },
      orderBy: [{ yeahs: "desc" }, { commentsCount: "desc" }],
      select: { id: true, userId: true, yeahs: true, text: true },
    })
    if (top && top.yeahs > 0) {
      const seen = await prisma.notification.findFirst({
        where: { type: `cotd:${top.id}` },
        select: { id: true },
      })
      if (!seen) {
        const { creditUser, CREDIT_CONFIG } = await import("@/lib/credits")
        const { getEffectiveTier } = await import("@/lib/tier")
        const author = await prisma.user.findUnique({
          where: { id: top.userId },
          select: { tier: true, tierExpiresAt: true },
        })
        const mult = author
          ? CREDIT_CONFIG.TIER_MULTIPLIER[getEffectiveTier(author) as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn ?? 0
          : 0
        const reward = Math.round(CREDIT_CONFIG.EARN.COTD_WIN * mult)
        if (reward > 0) {
          await creditUser(top.userId, "COTD_WIN", reward, `cotd_${top.id}`, {}).catch(() => {})
        } else {
          const { logMissedEarnings } = await import("@/lib/missedEarnings")
          await logMissedEarnings(top.userId, CREDIT_CONFIG.EARN.COTD_WIN, { source: "cotd", postId: top.id }).catch(() => {})
        }
        await prisma.post.update({
          where: { id: top.id },
          data: { pinnedUntil: new Date(now + 24 * 60 * 60 * 1000), isCOTD: true, cotdDate: new Date(now) },
        }).catch(() => {})
        await createNotification({
          userId: top.userId,
          type: `cotd:${top.id}`,
          title: "🏆 confession of the day!",
          body: `your post is featured for 24h${reward > 0 ? ` +${reward}cr` : ""}.`,
          href: `/post/${top.id}`,
        }).catch(() => {})
        results.cotd = { postId: top.id, reward }
      } else {
        results.cotd = { skipped: "already crowned" }
      }
    } else {
      results.cotd = { skipped: "no heat" }
    }
  } catch {
    results.cotd = { error: "failed" }
  }

  // 5. Win-back offers — 7d inactive → 100cr · 14d → 50% off PLUS (promo) ·
  // 30d → 500cr. Capped 200/run, deduped 30d per tier. Credits-only.
  try {
    const { creditUser, CREDIT_CONFIG } = await import("@/lib/credits")
    const tiers: { days: number; type: string; credits: number }[] = [
      { days: 30, type: "winback_30d", credits: CREDIT_CONFIG.EARN.WINBACK_30D },
      { days: 14, type: "winback_14d", credits: 0 },
      { days: 7, type: "winback_7d", credits: CREDIT_CONFIG.EARN.WINBACK_7D },
    ]
    const winback: Record<string, number> = { sent7: 0, sent14: 0, sent30: 0 }
    for (const t of tiers) {
      const cutoff = new Date(now - t.days * 24 * 60 * 60 * 1000)
      const older = new Date(now - (t.days + 30) * 24 * 60 * 60 * 1000)
      const users = await prisma.user.findMany({
        where: {
          emailVerified: true,
          status: "ACTIVE",
          OR: [{ lastPostedAt: { lt: cutoff } }, { lastPostedAt: null, createdAt: { lt: cutoff } }],
          createdAt: { lt: cutoff },
          notifications: { none: { type: t.type, createdAt: { gte: older } } },
        },
        select: { id: true },
        take: 200,
      })
      for (const u of users) {
        if (t.credits > 0) {
          const wbSeen = await prisma.creditTransaction.findFirst({ where: { userId: u.id, type: "WINBACK", reference: `${t.type}_${u.id}` }, select: { id: true } })
          if (!wbSeen) {
            await creditUser(u.id, "WINBACK", t.credits, `${t.type}_${u.id}`, {}).catch(() => {})
          }
        } else {
          // 50% off PLUS promo (single-use, checked in /api/subscribe).
          try {
            await prisma.analyticsEvent.create({
              data: { userId: u.id, type: "winback_promo", metadata: { kind: "plus", pct: 50, used: false } },
            })
          } catch {}
        }
        await createNotification({
          userId: u.id,
          type: t.type,
          title: t.days === 30 ? "🎁 500cr on the house — come back" : t.days === 14 ? "🎁 50% off PLUS, just for you" : "🎁 100cr waiting in your lair",
          body:
            t.days === 30
              ? "30 days is too long, ghost. 500 free credits — the yard missed you."
              : t.days === 14
                ? "half-price PLUS, today only in spirit. your ghosts miss you."
                : "the yard kept your seat warm. 100 free credits inside.",
          href: t.days === 14 ? "/upgrade" : "/lair",
        }).catch(() => {})
        if (t.days === 7) winback.sent7 += 1
        else if (t.days === 14) winback.sent14 += 1
        else winback.sent30 += 1
      }
    }
    results.winback = winback
  } catch {
    results.winback = { error: "failed" }
  }

  // 6. Tip leaderboard — weekly top tipper gets 500cr back + crown, monthly
  // top gets free PRIME. Idempotent per week/month via notification types.
  try {
    const { creditUser, CREDIT_CONFIG } = await import("@/lib/credits")
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const _d = new Date(now); const _day = new Date(Date.UTC(_d.getUTCFullYear(), _d.getUTCMonth(), _d.getUTCDate())); const _thisMon = new Date(_day.getTime() - ((_day.getUTCDay() + 6) % 7) * 86400000); const weekKey = _thisMon.toISOString().slice(0, 10)
    const tipped = await prisma.creditTransaction.findMany({
      where: { type: "TIP_SENT", amount: { lt: 0 }, createdAt: { gte: weekAgo } },
      select: { userId: true, amount: true },
      take: 20000,
    })
    const totals = new Map<string, number>()
    for (const t of tipped) totals.set(t.userId, (totals.get(t.userId) ?? 0) + Math.abs(t.amount))
    const [topId, topTotal] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    if (topId && (topTotal ?? 0) > 0) {
      const seen = await prisma.notification.findFirst({
        where: { userId: topId, type: `tip_crown:${weekKey}` },
        select: { id: true },
      })
      if (!seen) {
        await creditUser(topId, "TIP_CROWN", CREDIT_CONFIG.EARN.TIP_LEADER_WEEKLY, `tipcrown_${weekKey}`, {}).catch(() => {})
        // Badge: crown the profile too (weeklyChampion flag, shown as 👑).
        await prisma.user.update({ where: { id: topId }, data: { weeklyChampion: true } }).catch(() => {})
        await createNotification({
          userId: topId,
          type: `tip_crown:${weekKey}`,
          title: "🏆 weekly top tipper!",
          body: `you gave ${topTotal.toLocaleString()}cr in tips — 500cr back + the crown.`,
          href: "/lair",
        }).catch(() => {})
        results.tipCrown = { userId: topId, total: topTotal }
      } else {
        results.tipCrown = { skipped: "already crowned" }
      }
    } else {
      results.tipCrown = { skipped: "no tips" }
    }
    // Monthly crown — first run of the month grants free PRIME 31d.
    const d = new Date(now)
    if (d.getUTCDate() === 1) {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
      const monthTipped = await prisma.creditTransaction.findMany({
        where: { type: "TIP_SENT", amount: { lt: 0 }, createdAt: { gte: monthAgo } },
        select: { userId: true, amount: true },
        take: 20000,
      })
      const mTotals = new Map<string, number>()
      for (const t of monthTipped) mTotals.set(t.userId, (mTotals.get(t.userId) ?? 0) + Math.abs(t.amount))
      const [mId, mTotal] = [...mTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
      const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
      if (mId && (mTotal ?? 0) > 0) {
        const mSeen = await prisma.notification.findFirst({
          where: { userId: mId, type: `tip_crown_month:${monthKey}` },
          select: { id: true },
        })
        if (!mSeen) {
          const cur = await prisma.user.findUnique({ where: { id: mId }, select: { tierExpiresAt: true } })
          const base = Math.max(now, cur?.tierExpiresAt?.getTime() ?? 0)
          await prisma.user.update({
            where: { id: mId },
            data: { tier: "PRIME", tierExpiresAt: new Date(base + 31 * 24 * 60 * 60 * 1000) },
          }).catch(() => {})
          await createNotification({
            userId: mId,
            type: `tip_crown_month:${monthKey}`,
            title: "👑 monthly top tipper — free PRIME!",
            body: `you gave ${mTotal.toLocaleString()}cr in tips this month. 30 days of prime on the house.`,
            href: "/lair",
          }).catch(() => {})
          results.tipCrownMonth = { userId: mId, total: mTotal }
        }
      }
    }
  } catch {
    results.tipCrown = { error: "failed" }
  }

  // 7. Campus war close — Mondays settle LAST week's funding. Winning campus
  // (most funded points) gets its CampusChampion crowned to the top
  // contributor; top 3 contributors get +2 free boosts.
  try {
    const d = new Date(now)
    if (d.getUTCDay() === 1) {
      const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const thisMon = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86_400_000)
      const lastMon = new Date(thisMon.getTime() - 7 * 86_400_000)
      const rows = await prisma.creditTransaction.findMany({
        where: { type: "CAMPUS_WAR", createdAt: { gte: lastMon, lt: thisMon } },
        select: { userId: true, metadata: true },
        take: 20000,
      })
      const byCampus = new Map<string, { points: number; byUser: Map<string, number> }>()
      for (const r of rows) {
        const m = r.metadata as { campus?: unknown; points?: unknown } | null
        if (typeof m?.campus !== "string" || typeof m?.points !== "number") continue
        const slot = byCampus.get(m.campus) ?? { points: 0, byUser: new Map() }
        slot.points += m.points
        slot.byUser.set(r.userId, (slot.byUser.get(r.userId) ?? 0) + m.points)
        byCampus.set(m.campus, slot)
      }
      const winner = [...byCampus.entries()].sort((a, b) => b[1].points - a[1].points)[0]
      if (winner && winner[1].points > 0) {
        const [campus, data] = winner
        const top3 = [...data.byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        if (top3[0]) {
          await prisma.campusChampion.upsert({
            where: { campus },
            create: { campus, userId: top3[0][0] },
            update: { userId: top3[0][0] },
          }).catch(() => {})
        }
        for (const [uid] of top3) {
          const warSeen = await prisma.notification.findFirst({ where: { userId: uid, type: `war_win:${lastMon.toISOString().slice(0, 10)}` }, select: { id: true } })
          if (warSeen) continue
          await prisma.user.update({ where: { id: uid }, data: { freeBoosts: { increment: 2 } } }).catch(() => {})
          await createNotification({
            userId: uid,
            type: `war_win:${lastMon.toISOString().slice(0, 10)}`,
            title: "🏆 your campus won the war!",
            body: `${campus} takes the crown — +2 free boosts for funding the fight.`,
            href: "/battles",
          }).catch(() => {})
        }
        results.warClose = { winner: campus, points: data.points }
      } else {
        results.warClose = { skipped: "no funding" }
      }
    } else {
      results.warClose = { skipped: "runs mondays" }
    }
  } catch {
    results.warClose = { error: "failed" }
  }

  // 8. Scheduled posts publisher — due queue goes live (honors cross-campus
  // replication). Failures flip to failed, never silently drop.
  try {
    const due = await prisma.scheduledPost.findMany({
      where: { status: "pending", runAt: { lte: new Date(now) } },
      take: 100,
    })
    let published = 0
    for (const s of due) {
      try {
        const author = await prisma.user.findUnique({
          where: { id: s.userId },
          select: { id: true, status: true, program: true, programLevel: true, cohortYear: true, programKey: true },
        })
        if (!author || author.status !== "ACTIVE") {
          await prisma.scheduledPost.update({ where: { id: s.id }, data: { status: "failed" } }).catch(() => {})
          continue
        }
        const targets =
          s.campusTarget === "all"
            ? ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]
            : typeof s.campusTarget === "string" && s.campusTarget
              ? [s.campusTarget]
              : null
        const postIds: string[] = []
        if (targets) {
          for (const campus of targets) {
            const p = await prisma.post.create({
              data: {
                userId: s.userId,
                text: s.text,
                imageUrl: s.imageUrl,
                type: s.type || "confession",
                campus,
                program: author.program,
                programLevel: author.programLevel,
                cohortYear: author.cohortYear,
                programKey: author.programKey,
                visibility: s.visibility || "school",
              },
            })
            postIds.push(p.id)
          }
        } else {
          const home = await prisma.user.findUnique({ where: { id: s.userId }, select: { campus: true } })
          const p = await prisma.post.create({
            data: {
              userId: s.userId,
              text: s.text,
              imageUrl: s.imageUrl,
              type: s.type || "confession",
              campus: home?.campus ?? "University of Ghana",
              program: author.program,
              programLevel: author.programLevel,
              cohortYear: author.cohortYear,
              programKey: author.programKey,
              visibility: s.visibility || "school",
            },
          })
          postIds.push(p.id)
        }
        await prisma.scheduledPost.update({
          where: { id: s.id },
          data: { status: "posted", postIds },
        }).catch(() => {})
        published += 1
      } catch {
        await prisma.scheduledPost.update({ where: { id: s.id }, data: { status: "failed" } }).catch(() => {})
      }
    }
    results.scheduled = { published, due: due.length }
  } catch {
    results.scheduled = { error: "failed" }
  }

  // 9. Limited-drop live broadcast — weekly 48h avatar/theme drop
  // (see getWeeklyDrop in lib/credit-config). Batched Notification rows,
  // per-user dedupe via `drop_live:<id>` so reruns + the 2 live days never
  // double-notify. Capped 500 sends/run (dedupe cursor picks up next run).
  // Row-only on purpose (no push storm); SHOP TODO: shop route consumes
  // getWeeklyDrop() and flags `isLimited` + `endsAt`, charging
  // afterPriceCredits (2x) once the timer lapses.
  try {
    const { getWeeklyDrop } = await import("@/lib/credit-config")
    const drop = getWeeklyDrop(new Date(now))
    if (now >= drop.startsAt.getTime() && now <= drop.endsAt.getTime()) {
      const users = await prisma.user.findMany({
        where: {
          emailVerified: true,
          status: "ACTIVE",
          notifications: { none: { type: `drop_live:${drop.id}` } },
        },
        select: { id: true },
        take: 500,
      })
      if (users.length > 0) {
        await prisma.notification
          .createMany({
            data: users.map((u) => ({
              userId: u.id,
              type: `drop_live:${drop.id}`,
              title: "⏳ limited drop is live — 48h only",
              body: `${drop.name} ${drop.kind} for ${drop.priceCredits}cr (2x after). when it's gone, it's gone.`,
              href: "/shop",
            })),
          })
          .catch(() => {})
      }
      results.dropLive = { id: drop.id, sent: users.length, endsAt: drop.endsAt }
    } else {
      results.dropLive = { skipped: "no live drop" }
    }
  } catch {
    results.dropLive = { error: "failed" }
  }

  // 10. Emit-vs-sink guardrail — snapshot yesterday's full-day ratio, then
  // alert if emission ran >1.5× sinking for 3 straight days. The alert lands
  // in the admin error-alert channel (Discord/Slack) + an `emit_sink_alert`
  // event the Insights panel surfaces as a red banner (deduped 1/day).
  try {
    const { snapshotEmitSink, emitSinkStreak, EMIT_SINK_ALERT, EMIT_SINK_ALERT_DAYS } = await import("@/lib/emitSink")
    const snap = await snapshotEmitSink(new Date(now))
    const streak = await emitSinkStreak()
    results.emitSink = { emitted: snap.emitted, spent: snap.spent, ratio: snap.ratio, alert: streak.alert }
    if (streak.alert) {
      const dedupe = await prisma.analyticsEvent.findFirst({
        where: { userId: null, type: "emit_sink_alert", createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
        select: { id: true },
      }).catch(() => ({ id: "skip" }))
      if (!dedupe) {
        await prisma.analyticsEvent.create({
          data: {
            userId: null,
            type: "emit_sink_alert",
            metadata: { ratio: snap.ratio, snapshots: streak.snapshots },
          },
        }).catch(() => null)
        const { reportServerError } = await import("@/lib/errorAlerts")
        await reportServerError({
          route: "emit-sink-guard",
          error: `emit/sink ${snap.ratio.toFixed(2)}× — over ${EMIT_SINK_ALERT}× for ${EMIT_SINK_ALERT_DAYS} days`,
          metadata: { emitted: snap.emitted, spent: snap.spent, ratio: Number(snap.ratio.toFixed(3)) },
        }).catch(() => {})
      }
    }
  } catch {
    results.emitSink = { error: "failed" }
  }

  return NextResponse.json({ success: true, ...results })
}
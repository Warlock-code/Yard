import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { recordBattleWin } from "@/lib/champions"
import { creditUser, activeStreakMult, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"
import { getEffectiveTier } from "@/lib/tier"
import { sendPush } from "@/lib/sendPush"
import { createNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const scheduledDrafts = await prisma.aiDraft.findMany({
    where: { status: "scheduled_battle" },
  })

  const created: string[] = []
  const errors: string[] = []

  for (const draft of scheduledDrafts) {
    try {
      const scheduleData = JSON.parse(draft.text)
      const { campus, text, type, totalRounds, entryType, durationHours, schedule, scheduleTime, scheduleDays, seasonId } = scheduleData

      let nextStart: Date
      const scheduleTimeDate = new Date(scheduleTime)
      const today = new Date()
      today.setHours(scheduleTimeDate.getHours(), scheduleTimeDate.getMinutes(), 0, 0)

      if (today <= now) {
        if (schedule === "daily") {
          nextStart = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        } else if (schedule === "weekly") {
          nextStart = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        } else {
          continue
        }
      } else {
        nextStart = today
      }

      const dayOfWeek = nextStart.getDay()
      if (!scheduleDays.includes(dayOfWeek)) {
        continue
      }

      const nextEnd = new Date(nextStart.getTime() + durationHours * 60 * 60 * 1000)

      await prisma.battlePrompt.create({
        data: {
          text,
          campus,
          type,
          status: "UPCOMING",
          startsAt: nextStart,
          endsAt: nextEnd,
          totalRounds,
          roundNumber: 1,
          entryType,
          seasonId,
        },
      })

      await prisma.aiDraft.update({
        where: { id: draft.id },
        data: { text: JSON.stringify({ ...scheduleData, scheduleTime: nextStart.toISOString() }) },
      })

      created.push(`${campus} - ${text.slice(0, 30)}... at ${nextStart.toISOString()}`)
    } catch (err) {
      errors.push(`${draft.id}: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const upcomingPrompts = await prisma.battlePrompt.findMany({
    where: { status: "UPCOMING", startsAt: { lte: now } },
  })

  for (const prompt of upcomingPrompts) {
    await prisma.battlePrompt.update({
      where: { id: prompt.id },
      data: { status: "ACTIVE" },
    })
  }

  const activePrompts = await prisma.battlePrompt.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
  })

  for (const prompt of activePrompts) {
    if (prompt.type === "BRACKET" && prompt.roundNumber < prompt.totalRounds) {
      const entries = await prisma.battleEntry.findMany({
        where: { promptId: prompt.id },
        orderBy: { votes: "desc" },
      })

      if (entries.length >= 2) {
        const winners = entries.slice(0, Math.ceil(entries.length / 2))
        const winnerIds = winners.map(e => e.id)

        await prisma.battleEntry.updateMany({
          where: { id: { in: winnerIds } },
          data: { wonRound: true },
        })

        // Round-advancer prize: +1 free boost each (non-cash) + credit reward.
        // FREE tier still earns 0 here (shadow ledger only) — no farming.
        for (const w of winners) {
          const winnerUser = await prisma.user.findUnique({ where: { id: w.userId } })
          if (winnerUser) {
            const tier = getEffectiveTier(winnerUser)
            const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.battle ?? 1
            const winReward = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_BRACKET_ROUND * multiplier)
            const smult = await activeStreakMult(w.userId).catch(() => 1)
            const boostedReward = winReward * smult
            if (boostedReward > 0) {
              await creditUser(w.userId, "BATTLE_WIN", boostedReward, prompt.id, {
                promptId: prompt.id,
                entryId: w.id,
                battleType: "bracket_round",
                round: prompt.roundNumber,
                tier
              })
              await trackFeatureEvent({
                userId: w.userId,
                type: "battle_win_payout",
                pathname: "/battles",
                metadata: { promptId: prompt.id, entryId: w.id, battleType: "bracket_round", awarded: boostedReward, tier },
              }).catch(() => {})
            } else if (tier === "FREE") {
              // FREE shadow: what PLUS (battle 1x) would have paid. Display-only.
              const shadow = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_BRACKET_ROUND * 1)
              if (shadow > 0) {
                const { logMissedEarnings } = await import("@/lib/missedEarnings")
                await logMissedEarnings(w.userId, shadow, {
                  source: "battle_win",
                  promptId: prompt.id,
                  entryId: w.id,
                  battleType: "bracket_round",
                }).catch(() => {})
              }
              await trackFeatureEvent({
                userId: w.userId,
                type: "battle_win_payout",
                pathname: "/battles",
                metadata: { promptId: prompt.id, entryId: w.id, battleType: "bracket_round", awarded: 0, shadow, tier },
              }).catch(() => {})
            }
            await prisma.user.update({
              where: { id: w.userId },
              data: { freeBoosts: { increment: 1 } },
            })
          }
        }

        const nextRoundPrompt = await prisma.battlePrompt.create({
          data: {
            text: `${prompt.text} (Round ${prompt.roundNumber + 1})`,
            campus: prompt.campus,
            type: "BRACKET",
            status: "ACTIVE",
            startsAt: now,
            endsAt: new Date(now.getTime() + (prompt.endsAt.getTime() - prompt.startsAt.getTime())),
            totalRounds: prompt.totalRounds,
            roundNumber: prompt.roundNumber + 1,
            parentPromptId: prompt.id,
            entryType: prompt.entryType,
            seasonId: prompt.seasonId,
          },
        })

        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })

        await createNotificationsForRoundStart(nextRoundPrompt, winners)
      } else {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })
      }
    } else if (prompt.type === "BRACKET" && prompt.roundNumber === prompt.totalRounds) {
      // Final bracket round - winner gets BATTLE_WIN_FINAL
      const winner = await prisma.battleEntry.findFirst({
        where: { promptId: prompt.id },
        orderBy: { votes: "desc" },
        include: { prompt: { select: { id: true, text: true, campus: true } } },
      })

      if (winner) {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED", winnerEntryId: winner.id },
        })

        await prisma.battleEntry.update({
          where: { id: winner.id },
          data: { wonRound: true },
        })

        await updateBattleStats(winner.userId, true)
        await recordBattleWin(winner.userId, prompt.campus)
        await grantWinPrize(winner.userId, prompt.id, prompt.text, 2)

        // Credit reward for BRACKET FINAL win: base win reward or 75% of the
        // entry-fee pot, whichever is bigger. Platform keeps the other 25%
        // (burned — never credited; recorded as rake in metadata).
        // FREE never earns real credits — shadow MISSED row only.
        const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId } })
        if (winnerUser) {
          const tier = getEffectiveTier(winnerUser)
          const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.battle ?? 1
          const baseReward = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_FINAL * multiplier)
          const pot = await battlePotStats(prompt.id)
          const smult = await activeStreakMult(winner.userId).catch(() => 1)
          if (tier === "FREE") {
            const shadow = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_FINAL * 1)
            if (shadow > 0) {
              const { logMissedEarnings } = await import("@/lib/missedEarnings")
              await logMissedEarnings(winner.userId, shadow, {
                source: "battle_win",
                promptId: prompt.id,
                entryId: winner.id,
                battleType: "bracket_final",
                potSize: pot.pot,
              }).catch(() => {})
            }
            await trackFeatureEvent({
              userId: winner.userId,
              type: "battle_win_payout",
              pathname: "/battles",
              metadata: { promptId: prompt.id, entryId: winner.id, battleType: "bracket_final", awarded: 0, shadow, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
            }).catch(() => {})
          } else {
            const winReward = Math.max(baseReward * smult, pot.winnerShare)
            if (winReward > 0) {
              await creditUser(winner.userId, "BATTLE_WIN", winReward, prompt.id, {
                promptId: prompt.id,
                entryId: winner.id,
                battleType: "bracket_final",
                potSize: pot.pot,
                rake: pot.rake,
                potShare: pot.winnerShare,
                baseReward,
                tier
              })
              await trackFeatureEvent({
                userId: winner.userId,
                type: "battle_win_payout",
                pathname: "/battles",
                metadata: { promptId: prompt.id, entryId: winner.id, battleType: "bracket_final", awarded: winReward, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
              }).catch(() => {})
            }
          }
        }

        for (const entry of await prisma.battleEntry.findMany({ where: { promptId: prompt.id, userId: { not: winner.userId } } })) {
          await updateBattleStats(entry.userId, false)
        }
      } else {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })
      }
    } else {
      const winner = await prisma.battleEntry.findFirst({
        where: { promptId: prompt.id },
        orderBy: { votes: "desc" },
        include: { prompt: { select: { id: true, text: true, campus: true } } },
      })

      if (winner) {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED", winnerEntryId: winner.id },
        })

        await prisma.battleEntry.update({
          where: { id: winner.id },
          data: { wonRound: true },
        })

        await updateBattleStats(winner.userId, true)
        await recordBattleWin(winner.userId, prompt.campus)
        await grantWinPrize(winner.userId, prompt.id, prompt.text, 2)

        // Credit reward for single battle win: base (500 PLUS / 1000 PRIME
        // via battle multiplier × streak) or 75% of the pot, whichever is
        // bigger. Platform keeps the other 25% (burned — rake in metadata).
        // FREE never earns real credits — shadow MISSED row only.
        const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId } })
        if (winnerUser) {
          const tier = getEffectiveTier(winnerUser)
          const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.battle ?? 1
          const baseReward = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_SINGLE * multiplier)
          const pot = await battlePotStats(prompt.id)
          const smult = await activeStreakMult(winner.userId).catch(() => 1)
          if (tier === "FREE") {
            const shadow = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_SINGLE * 1)
            if (shadow > 0) {
              const { logMissedEarnings } = await import("@/lib/missedEarnings")
              await logMissedEarnings(winner.userId, shadow, {
                source: "battle_win",
                promptId: prompt.id,
                entryId: winner.id,
                battleType: "single",
                potSize: pot.pot,
              }).catch(() => {})
            }
            await trackFeatureEvent({
              userId: winner.userId,
              type: "battle_win_payout",
              pathname: "/battles",
              metadata: { promptId: prompt.id, entryId: winner.id, battleType: "single", awarded: 0, shadow, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
            }).catch(() => {})
          } else {
            const winReward = Math.max(baseReward * smult, pot.winnerShare)
            if (winReward > 0) {
              await creditUser(winner.userId, "BATTLE_WIN", winReward, prompt.id, {
                promptId: prompt.id,
                entryId: winner.id,
                battleType: "single",
                potSize: pot.pot,
                rake: pot.rake,
                potShare: pot.winnerShare,
                baseReward,
                tier
              })
              await trackFeatureEvent({
                userId: winner.userId,
                type: "battle_win_payout",
                pathname: "/battles",
                metadata: { promptId: prompt.id, entryId: winner.id, battleType: "single", awarded: winReward, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
              }).catch(() => {})
            }
          }
        }

        for (const entry of await prisma.battleEntry.findMany({ where: { promptId: prompt.id, userId: { not: winner.userId } } })) {
          await updateBattleStats(entry.userId, false)
        }
      } else {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })
      }
    }
  }

  const votingPrompts = await prisma.battlePrompt.findMany({
    where: { status: "VOTING", endsAt: { lte: now } },
  })

  for (const prompt of votingPrompts) {
    const winner = await prisma.battleEntry.findFirst({
      where: { promptId: prompt.id },
      orderBy: { votes: "desc" },
      include: { prompt: { select: { id: true, text: true, campus: true } } },
    })

    if (winner) {
      await prisma.battlePrompt.update({
        where: { id: prompt.id },
        data: { status: "COMPLETED", winnerEntryId: winner.id },
      })
      await recordBattleWin(winner.userId, prompt.campus)
      await grantWinPrize(winner.userId, prompt.id, prompt.text, 2)
      // VOTING-close win: same pot-share prize as a single win.
      // FREE never earns real credits — shadow MISSED row only.
      const vw = await prisma.user.findUnique({ where: { id: winner.userId } })
      if (vw) {
        const tier = getEffectiveTier(vw)
        const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.battle ?? 1
        const baseReward = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_SINGLE * multiplier)
        const pot = await battlePotStats(prompt.id)
        const smult = await activeStreakMult(winner.userId).catch(() => 1)
        if (tier === "FREE") {
          const shadow = Math.round(CREDIT_CONFIG.EARN.BATTLE_WIN_SINGLE * 1)
          if (shadow > 0) {
            const { logMissedEarnings } = await import("@/lib/missedEarnings")
            await logMissedEarnings(winner.userId, shadow, {
              source: "battle_win",
              promptId: prompt.id,
              entryId: winner.id,
              battleType: "voting_close",
              potSize: pot.pot,
            }).catch(() => {})
          }
          await trackFeatureEvent({
            userId: winner.userId,
            type: "battle_win_payout",
            pathname: "/battles",
            metadata: { promptId: prompt.id, entryId: winner.id, battleType: "voting_close", awarded: 0, shadow, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
          }).catch(() => {})
        } else {
          const winReward = Math.max(baseReward * smult, pot.winnerShare)
          if (winReward > 0) {
            await creditUser(winner.userId, "BATTLE_WIN", winReward, prompt.id, {
              promptId: prompt.id,
              entryId: winner.id,
              battleType: "voting_close",
              potSize: pot.pot,
              rake: pot.rake,
              potShare: pot.winnerShare,
              baseReward,
              tier,
            }).catch(() => {})
            await trackFeatureEvent({
              userId: winner.userId,
              type: "battle_win_payout",
              pathname: "/battles",
              metadata: { promptId: prompt.id, entryId: winner.id, battleType: "voting_close", awarded: winReward, potSize: pot.pot, rake: pot.rake, potShare: pot.winnerShare, tier },
            }).catch(() => {})
          }
        }
      }
    }
  }

  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)
  const startingSoon = await prisma.battlePrompt.findMany({
    where: { status: "UPCOMING", startsAt: { gte: now, lte: tenMinutesFromNow } },
  })

  for (const prompt of startingSoon) {
    await createStartingSoonNotifications(prompt)
  }

  return NextResponse.json({ created, errors, processed: scheduledDrafts.length })
}

async function createNotificationsForRoundStart(prompt: { id: string; text: string; campus: string; roundNumber: number }, winners: { id: string; userId: string }[]) {
  const winnerUserIds = winners.map(w => w.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: winnerUserIds }, campus: prompt.campus },
    select: { id: true, pushToken: true, deviceTokens: { select: { token: true } } },
  })

  for (const user of users) {
    const tokens = new Set([
      ...user.deviceTokens.map(d => d.token),
      user.pushToken,
    ].filter((t): t is string => Boolean(t)))

    for (const token of tokens) {
      // Direct dispatch: never throws (sendPush swallows transport errors),
      // so one bad token can't abort the remaining notifications.
      await sendPush(
        token,
        `Round ${prompt.roundNumber} Starting!`,
        `Your entry advanced! "${prompt.text}"`,
        `/battles/${prompt.id}`
      )
    }
  }
}

async function createStartingSoonNotifications(prompt: { id: string; text: string; campus: string }) {
  const users = await prisma.user.findMany({
    where: { campus: prompt.campus },
    select: { id: true, pushToken: true, deviceTokens: { select: { token: true } } },
  })

  for (const user of users) {
    const tokens = new Set([
      ...user.deviceTokens.map(d => d.token),
      user.pushToken,
    ].filter((t): t is string => Boolean(t)))

    for (const token of tokens) {
      await sendPush(
        token,
        "Battle Starting Soon!",
        `"${prompt.text}" starts in 10 minutes. Get ready!`,
        `/battles/${prompt.id}`
      )
    }
  }
}

/** Battle pot stats: total entry fees paid into this prompt (pot), the 25%
 * platform rake (burned — never credited to anyone), and the 75% winner
 * share. Sums actual BATTLE_ENTRY / DUEL_ENTRY debits so ghost duels (500cr)
 * and normal battles (200cr) both settle correctly. */
async function battlePotStats(promptId: string): Promise<{ pot: number; rake: number; winnerShare: number }> {
  try {
    const fees = await prisma.creditTransaction.findMany({
      where: { reference: promptId, type: { in: ["BATTLE_ENTRY", "DUEL_ENTRY"] }, amount: { lt: 0 } },
      select: { amount: true },
    })
    const pot = fees.reduce((s, f) => s + Math.abs(f.amount), 0)
    const rake = Math.floor((pot * CREDIT_CONFIG.BATTLE.RAKE_PCT) / 100)
    const winnerShare = Math.floor((pot * CREDIT_CONFIG.BATTLE.WINNER_PCT) / 100)
    return { pot, rake, winnerShare }
  } catch {
    return { pot: 0, rake: 0, winnerShare: 0 }
  }
}

/** Winner's 75% cut of the entry-fee pot (see battlePotStats). */
async function battlePotShare(promptId: string) {
  return (await battlePotStats(promptId)).winnerShare
}

/** Winner prize: free boosts (non-cash) + in-app/push/socket win alert.
 * Idempotent per prompt — reruns never double-grant. */
async function grantWinPrize(userId: string, promptId: string, promptText: string, boosts: number) {
  const existing = await prisma.notification.findFirst({
    where: { userId, type: "battle_win", href: `/battles/${promptId}` },
    select: { id: true },
  })
  if (existing) return
  await prisma.user.update({
    where: { id: userId },
    data: { freeBoosts: { increment: boosts } },
  })
  await createNotification({
    userId,
    type: "battle_win",
    title: "🏆 you won the battle!",
    body: `your take won — +${boosts} free boosts added. spend them in feed.`,
    href: `/battles/${promptId}`,
  }).catch(() => {})
}

async function updateBattleStats(userId: string, won: boolean) {
  await prisma.battleStats.upsert({
    where: { userId },
    create: {
      userId,
      totalBattles: 1,
      totalEntries: 1,
      totalWins: won ? 1 : 0,
      winRate: won ? 100 : 0,
      currentStreak: won ? 1 : 0,
      bestStreak: won ? 1 : 0,
      lastBattleAt: new Date(),
    },
    update: {
      totalBattles: { increment: 1 },
      totalEntries: { increment: 1 },
      totalWins: { increment: won ? 1 : 0 },
      currentStreak: won ? { increment: 1 } : 0,
      bestStreak: won ? { increment: 1 } : { increment: 0 },
      winRate: won
        ? { increment: (100 - 0) / 1 }
        : { decrement: 0 },
      lastBattleAt: new Date(),
    },
  })
}
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const SEED_GHOSTS = [
  { ghostId: "MidnightScholar", avatarEmoji: "👻" },
  { ghostId: "QuietStorm_22", avatarEmoji: "🐍" },
  { ghostId: "CampusWhisperer", avatarEmoji: "👽" },
  { ghostId: "HallwayGhost", avatarEmoji: "👻" },
  { ghostId: "TheRealTalker", avatarEmoji: "🧙" },
  { ghostId: "SilentObserver", avatarEmoji: "🦇" },
  { ghostId: "NightOwlNotes", avatarEmoji: "👻" },
  { ghostId: "LibraryLurker", avatarEmoji: "🕷️" },
  { ghostId: "DailyConfessor", avatarEmoji: "😂" },
  { ghostId: "CanteenCritic", avatarEmoji: "👻" },
]

const gistPosts = [
  {
    text: "Herh Legon freshers make una open eye ooo 😭 Someone inside my Telegram group dey sell Hilla Limann bed for GH¢2500, single room self dem dey call GH¢4000. Official school fee be like 1300 but these boys dey do protocol plus 'emergency allocation' 😂 The guy even say 'pay now or you go perch for common room'. Wayo too much for Legon rn #UGHostelScam #HillaLimann #LegonGist #HostelWayo",
    campus: "University of Ghana",
    type: "gossip",
    yeahs: 187,
    boosted: true,
    ghostId: "MidnightScholar",
    comments: [
      { ghostId: "QuietStorm_22", text: "Chale I pay 2k for Limann last year, the guy block me after momo. Perching for 3 weeks before I get refund 😭" },
      { ghostId: "CampusWhisperer", text: "Herrh hall secretary say no bed dey sell for that price o, all be scam. Go hall office direct, no pay anybody for Telegram" },
      { ghostId: "HallwayGhost", text: "Legon hostel mafia is real. They buy 6 beds with different IDs then resell 💀 Ebi business for some seniors" },
    ]
  },
  {
    text: "KNUST SRC don drop warning ooo!! Freshers intake Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀 One guy for my SHS group collect GH¢800 from 12 people then comot. Official KNUST no dey do admission for WhatsApp, everything be portal only! Abeg share make e reach your junior #KNUST #AdmissionScam #KNUSTFreshers #WayoAlert",
    campus: "KNUST",
    type: "gossip",
    yeahs: 213,
    boosted: true,
    ghostId: "HallwayGhost",
    comments: [
      { ghostId: "LibraryLurker", text: "My cousin nearly pay o, the guy even get fake KNUST letterhead. Thank God we video call am e run 😂 wayo guy" },
      { ghostId: "SilentObserver", text: "SRC gossip page posted list of fake numbers, check their IG @knust_src. More than 30 numbers blocked already" },
      { ghostId: "CampusWhisperer", text: "Same people go resurface next year with new number, same format. Ebi business for them herh" },
    ]
  },
  {
    text: "Eii the UCC portal don mad 😭😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates?? Screenshot dey go viral for status. One guy say e reach ein room see 3 girls dey unpack 😭 Management say 'system glitch please be patient' but chale this glitch fit cause serious wahala o #UCCGist #HostelAllocation #PortalGlitch #GhanaUni",
    campus: "UCC",
    type: "gossip",
    yeahs: 142,
    boosted: true,
    ghostId: "CanteenCritic",
    comments: [
      { ghostId: "DailyConfessor", text: "Lmao my mate got allocated to Adehye by mistake, he was happy sey e go enjoy till they reverse am 😂😂" },
      { ghostId: "NightOwlNotes", text: "Herh UCC IT people dey play, how gender go mix for hostel allocation system?? Who code that thing??" },
      { ghostId: "CampusWhisperer", text: "They said they go reassign by Friday but now nobody dey trust the portal again. Freshers dey panic o" },
    ]
  },
  {
    text: "Private hostel price wars for KNUST/Bomso-Ayeduase side e be wildin rn 😭 Last sem hostel for GH¢3500, this sem same room GH¢6200 + GH¢500 protocol fee + GH¢300 agent viewing fee ??? Mom and dad dey cry. Landlords dey compete who go charge highest but rooms still be 4x4 cubicle with leaking roof. Chale how student go survive for Ghana #HostelPrices #ProtocolFee #StudentLifeGH #GhanaUniScam",
    campus: "KNUST",
    type: "gossip",
    yeahs: 95,
    boosted: true,
    ghostId: "TheRealTalker",
    comments: [
      { ghostId: "QuietStorm_22", text: "Bomso hostel from 4k to 6.5k in one year, plus they want 2 years advance herrh. Who get that money??" },
      { ghostId: "SilentObserver", text: "My landlord add 'maintenance fee' 700 cedis, maintenance wey e never do since 2023. Pure wayo" },
      { ghostId: "CampusWhisperer", text: "Next sem we go sleep for lecture hall be that 😭 Chale price control no dey for private hostels?" },
    ]
  },
  {
    text: "Yooo UPSA freshers make una hear gist 😭😭 There be this popular hostel agent for Madina/Okponglo wey dey charge GH¢200 just to SHOW you room, then after viewing e say 'pay GH¢450 protocol to secure am' then e vanish! My roommate sent momo 650 total, number switched off. Legit agents no dey take money before keys, abeg don't pay any protocol unless for hostel OFFICE #UPSA #HostelScamAlert #MadinaHostels #FreshersGuide",
    campus: "UPSA",
    type: "gossip",
    yeahs: 178,
    boosted: true,
    ghostId: "NightOwlNotes",
    comments: [
      { ghostId: "MidnightScholar", text: "This be same guy with 3 different IG pages o, hostelhub_gh and legit_hostels_gh all be am. Wey tin be this" },
      { ghostId: "HallwayGhost", text: "Chale agent take my 300 last year same trick, till now I dey perch for senior ein floor 😭 Never again" },
      { ghostId: "SilentObserver", text: "If den ask for momo before receipt, na scam. No receipt no payment, simple!" },
    ]
  }
]

async function main() {
  const users = []
  for (const g of SEED_GHOSTS) {
    const user = await prisma.user.upsert({
      where: { email: `${g.ghostId.toLowerCase()}@seed.yardapp.me` },
      update: {},
      create: {
        email: `${g.ghostId.toLowerCase()}@seed.yardapp.me`,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: "University of Ghana",
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))

  let created = 0
  for (const p of gistPosts) {
    const author = userByGhost.get(p.ghostId)
    if (!author) continue
    // ensure author campus matches post campus for feed visibility
    if (author.campus !== p.campus) {
      await prisma.user.update({ where: { id: author.id }, data: { campus: p.campus } })
    }
    const post = await prisma.post.create({
      data: {
        userId: author.id,
        text: p.text,
        type: p.type,
        campus: p.campus,
        visibility: "school",
        yeahs: p.yeahs,
        boosted: p.boosted,
        boostedUntil: p.boosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
      },
    })
    // process hashtags
    const { processPostHashtags } = await import("../lib/search.ts")
    await processPostHashtags(post.id, p.text, p.campus).catch(() => {})

    for (const c of p.comments) {
      const commenter = userByGhost.get(c.ghostId)
      if (!commenter) continue
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: commenter.id,
          ghostId: commenter.ghostId,
          text: c.text,
        },
      })
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { commentsCount: p.comments.length }
    })
    created++
  }
  console.log(`Seeded ${created} Ghana hostel scam gist posts with comments.`)
}

main().finally(() => prisma.$disconnect())

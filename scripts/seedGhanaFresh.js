import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const GHOSTS = [
  { ghostId: "MidnightScholar", avatarEmoji: "👻", campus: "University of Ghana", email: "midnightscholar@seed.yardapp.me" },
  { ghostId: "QuietStorm_22", avatarEmoji: "🐍", campus: "KNUST", email: "quietstorm_22@seed.yardapp.me" },
  { ghostId: "CampusWhisperer", avatarEmoji: "👽", campus: "UCC", email: "campuswhisperer@seed.yardapp.me" },
  { ghostId: "HallwayGhost", avatarEmoji: "👻", campus: "KNUST", email: "hallwayghost@seed.yardapp.me" },
  { ghostId: "TheRealTalker", avatarEmoji: "🧙", campus: "University of Ghana", email: "therealtalker@seed.yardapp.me" },
  { ghostId: "SilentObserver", avatarEmoji: "🦇", campus: "UCC", email: "silentobserver@seed.yardapp.me" },
  { ghostId: "NightOwlNotes", avatarEmoji: "👻", campus: "KNUST", email: "nightowlnotes@seed.yardapp.me" },
  { ghostId: "LibraryLurker", avatarEmoji: "🕷️", campus: "UEW", email: "librarylurker@seed.yardapp.me" },
  { ghostId: "DailyConfessor", avatarEmoji: "😂", campus: "UPSA", email: "dailyconfessor@seed.yardapp.me" },
  { ghostId: "CanteenCritic", avatarEmoji: "👻", campus: "GCTU", email: "canteencritic@seed.yardapp.me" },
  { ghostId: "DriftStorm_9394", avatarEmoji: "👻", campus: "GCTU", email: "driftstorm_9394@seed.yardapp.me" },
  { ghostId: "LegonSleeper", avatarEmoji: "😴", campus: "University of Ghana", email: "legonsleeper@seed.yardapp.me" },
]

const POSTS = [
  // Relationships 6
  {
    text: "Chale for KNUST Bush Canteen today, guy catch ein babe dey chop with another guy. She kneel for ground dey cry say 'it be the devil' 😭 Herh campus couples mad ooo, every week new movie. How for do? #gossip #relationships",
    campus: "KNUST", type: "gossip", yeahs: 212, boosted: true, comments: ["Herh this be real movie wai 😂 Bush Canteen again??","Chale KNUST girls no dey shame again ooo","Ei the kneeling video go soon drop for telegram"],
  },
  {
    text: "Ei I dey clean my contacts, 60% be 'Foolish Boy 💔', 'God Punish You', 'Block Me 😒' Herh UG boys we suffer. If your ex name still sweet for phone you be learner 😂 Chale how for do? #relationships #gossip",
    campus: "University of Ghana", type: "meme", yeahs: 178, boosted: false, comments: ["Chale mine be 'Anointing Oil Thief' 😂😂","Herh why you no just delete am then?","UG babe save me as 'Momo' cos I dey send money only"],
  },
  {
    text: "Herh Kwaprow cohabitation go kill man 😭 Move in with babe level 200, now I dey cook, clean, wash plus I dey carry 1.9 GPA. She say 'we be couple' but my result dey cry. Chale how for do? #hostellife #relationships",
    campus: "UCC", type: "confession", yeahs: 143, boosted: true, comments: ["Chale you be chef and student? double degree 😂","Run ooo Kwaprow boys suffer pass","Ei 1.9? Herh babe chop your brain too"],
  },
  {
    text: "Chale UPSA level 100 babe get Odogwu plus 2 Zaddies dey pay fees, hostel, hair 😭 She say 'sugar no be hookup, na networking' Herh mad ooo, degree no be the only hustle for campus. #gossip #hostellife",
    campus: "UPSA", type: "confession", yeahs: 89, boosted: false, comments: ["Networking or net-worthing? 😂","Chale Odogwu dey sponsor whole department","Herh UPSA girls get business mind pass MBA"],
  },
  {
    text: "Ei UEW relationship pressure mad ooo 😭 Guy threaten he go drink sniper sake babe block am, whole hostel no sleep dey beg am 3am. Chale love no be death sentence, if e no work waka! Herh we need counseling. #relationships",
    campus: "UEW", type: "gossip", yeahs: 67, boosted: false, comments: ["Chale this one de3 e be serious, check on am wai","Ei block no be murder, he for calm down","Herh UEW love dey turn horror movie"],
  },
  {
    text: "My guy move go Ayeduase go cohabit Kotei side, now he be houseboy 😂 Dey cook jollof 6am before class, babe still dey cheat for Galloway. Herh men dey suffer for love ooo. GCTU boys make we learn! #hostellife #gossip",
    campus: "GCTU", type: "gossip", yeahs: 134, boosted: true, comments: ["6am jollof? He be husband already 😂","Chale Ayeduase to Kotei na full marriage","Herh he for come back to campus hostel wai"],
  },
  // Lecturer 4
  {
    text: "Legon babe here make I vent anonymous 😭💔 That married lecturer for our dept way everybody know but nobody dey talk... every small thing 'come to my office after 5pm ALONE' . My paddie refused, he vex tell am 'if you want to pass my course you know what to do' and threatened to fail am kraa. He get wife and kids for Legon sef still dey do this! If you report, HOD go tell you 'don't spoil his family, settle am privately' Herh we dey fear pass. BBC show already but man still dey teach same course. How for do?? #sexforgrades #legon",
    campus: "University of Ghana", type: "confession", yeahs: 147, boosted: true, comments: ["Herh which course be this?? Abeg DM me initials make we avoid am","Make them leak name nooo, married man mpo dey do this smh","Chale same thing my cousin face for PoliSci"],
  },
  {
    text: "KNUST freshers abeg open your eyes oo!! One TA for Engineering dey target Level 100 girls like hobby 😒 He go purposely mark you low for practicals then DM you for WhatsApp 'I can help you, come to my place at night let me teach you privately' If you gree he go sort your marks, if you bounce am he go fail you wicked. My roommate fall victim last sem. #knust #tafromhell",
    campus: "KNUST", type: "gossip", yeahs: 83, boosted: true, comments: ["We know am!! That fair TA wey dey mark Chem practicals??","Level 100s be vulnerable pass","Report go Dean of Students anonymously kraa"],
  },
  {
    text: "After BBC Africa Eye Sex for Grades expose Legon for 2019 we thought things go change, chale NOTHING change o 😔 Same married men still dey demand office visits and threaten girls wey refuse. The culture of silence be too real - if you talk dem go label you 'ashawo'. Girls dey suffer in silence because dem dey fear. #bbcsexforgrades #sexforgrades",
    campus: "University of Ghana", type: "confession", yeahs: 172, boosted: true, comments: ["FACTS!! After BBC sef dem just transfer one go different dept","Culture of silence go kill us","If you get evidence leak am anonymously for Yard"],
  },
  {
    text: "Hall gist wey dey pain me pass 😤 For my hall for UCC, hall tutors dey sell beds for 3k-5k cedis but if you be fine girl dem go whisper 'come see me in my room privately we can arrange' 😒 Meaning bed for favours... My friend slept on floor for 3 weeks cos she no gree. #ucc #hallgist",
    campus: "UCC", type: "gossip", yeahs: 56, boosted: true, comments: ["UCC hall system be scam","Herh 3k for bed??","Make we expose them"],
  },
  // Hostel scam 5
  {
    text: "Herh Legon freshers make una open eye ooo 😭 Someone inside my Telegram group dey sell Hilla Limann bed for GH¢2500, single room self dem dey call GH¢4000. Official school fee be like 1300 but these boys dey do protocol plus 'emergency allocation' 😂 The guy even say 'pay now or you go perch for common room'. Wayo too much for Legon rn #UGHostelScam #HillaLimann",
    campus: "University of Ghana", type: "gossip", yeahs: 187, boosted: true, comments: ["Chale I pay 2k for Limann last year, the guy block me after momo 😭","Herrh hall secretary say no bed dey sell for that price o","Legon hostel mafia is real"],
  },
  {
    text: "KNUST SRC don drop warning ooo!! Freshers intake Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀 One guy for my SHS group collect GH¢800 from 12 people then comot. Official KNUST no dey do admission for WhatsApp! #KNUST #AdmissionScam",
    campus: "KNUST", type: "gossip", yeahs: 213, boosted: true, comments: ["My cousin nearly pay o, the guy even get fake KNUST letterhead","SRC gossip page posted list of fake numbers","Same people go resurface next year"],
  },
  {
    text: "Eii the UCC portal don mad 😭😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates?? Screenshot dey go viral for status. One guy say e reach ein room see 3 girls dey unpack 😭 Management say 'system glitch please be patient' #UCCGist #PortalGlitch",
    campus: "UCC", type: "gossip", yeahs: 142, boosted: true, comments: ["Lmao my mate got allocated to Adehye by mistake","Herh UCC IT people dey play","They said they go reassign by Friday"],
  },
  {
    text: "Private hostel price wars for KNUST/Bomso-Ayeduase side e be wildin rn 😭 Last sem hostel for GH¢3500, this sem same room GH¢6200 + GH¢500 protocol fee + GH¢300 agent viewing fee ??? Mom and dad dey cry. #HostelPrices #ProtocolFee",
    campus: "KNUST", type: "gossip", yeahs: 95, boosted: true, comments: ["Bomso hostel from 4k to 6.5k in one year","My landlord add 'maintenance fee' 700 cedis","Next sem we go sleep for lecture hall"],
  },
  {
    text: "Yooo UPSA freshers make una hear gist 😭😭 There be this popular hostel agent for Madina/Okponglo wey dey charge GH¢200 just to SHOW you room, then after viewing e say 'pay GH¢450 protocol to secure am' then e vanish! My roommate sent momo 650 total, number switched off. #UPSA #HostelScamAlert",
    campus: "UPSA", type: "gossip", yeahs: 178, boosted: true, comments: ["This be same guy with 3 different IG pages o","Chale agent take my 300 last year same trick","If den ask for momo before receipt, na scam"],
  },
  // Safety 4
  {
    text: "Herrh chale this gist dey worry me fr 😔 Someone compile am sey about 13 non-natural student deaths reported across Ghana unis since 2024, mostly road accidents plus a few suspected suicide cases. Not spreading fear but chale we for look out for each other. If you dey feel low abeg talk to someone. #safety #UCC #KNUST",
    campus: "UCC", type: "gossip", yeahs: 118, boosted: true, comments: ["Fr fr, UCC counseling centre dey free","That Cape Coast highway be death trap at night","We start daily 'you good?' check for our block now"],
  },
  {
    text: "Still thinking about Innocentia Avinu from UCC 🕊️ That beach incident last year really pain me. Young, bright, whole life ahead herrh. I know beach be vibe for birthdays but Cape Coast tides no dey joke especially evening/solo waka. Abeg always go with squad. #safety #UCC #RIP",
    campus: "UCC", type: "gossip", yeahs: 94, boosted: true, comments: ["May she rest well 🙏 my cousin be lifeguard","True talk, we cancelled our evening beach shoot","Daytime + group only now"],
  },
  {
    text: "KNUST hostel gist got me anxious chale 😓 That fall from hostel story wey circulate plus all those late night movement warnings for ladies around Ayeduase/Kotei/Tech junction. Chale no be play. Balcony no be chill spot abeg. #safety #KNUST #hostellife",
    campus: "KNUST", type: "gossip", yeahs: 76, boosted: true, comments: ["Facts! That Ayeduase road dark too much after 8pm","Landlords really need to do safety check","Ladies pls pin location to roomie"],
  },
  {
    text: "This KNUST relationship + hook-up party gist dey scare me herrh 🥺 Heard about relationship wey turn violent plus those 'link-up' parties where drinks go bad quick. Chale love no be by force, if e be controlling, threatening abeg speak out. #safety #KNUST #consent",
    campus: "KNUST", type: "gossip", yeahs: 132, boosted: true, comments: ["Real talk, if friend invite you to hook-up party check who dey organize","Relationship red flags no be joke"],
  },
  // Everyday 5
  {
    text: "6:30am lecture for Legon?? Herrh this lecturer enter class like ein wife beat am for dawn 😭 Shout dey give everybody 'WHY YOU LATE' my guy we self we never sleep, we dey battle trotro since 5am. Chale abolish 6:30am lectures abeg! #LegonWahala #630AMTorture",
    campus: "University of Ghana", type: "gossip", yeahs: 234, boosted: true, comments: ["Chale that man need therapy not students 😂","You for see ein face, like he no chop morning food","Eii UG lecturers dey vex pass KNUST own??"],
  },
  {
    text: "UCC library no be library again, na TikTok headquarters 😂 Assignment due midnight but Auntie for aisle 3 dey do 'everybody tap tap' challenge with ring light. Books dey cry for corner, GPA dey sink but views dey rise. #UCCAfterClass #TikTokOverBooks",
    campus: "UCC", type: "meme", yeahs: 178, boosted: false, comments: ["Facts 😭 I go library go read, I come back with 3 drafts for TikTok","The girl wey dey dance get 4.2 GPA sef"],
  },
  {
    text: "Katanga vs Unity hall gist too loud chale 😭 You dey try sleep midnight then next room dey host bedroom conference, morning you hear for staircase 'so na you dey date hall secretary AND SRC babe?' Eii who dey sleep with who for this hall sef?? WiFi no dey work but gossip dey stream for 5G #KNUSTGist #HallGossip",
    campus: "KNUST", type: "gossip", yeahs: 267, boosted: true, comments: ["Katanga hall never disappoints 😂","Hall gossip dey move faster than KNUST WiFi","Mention hall sec name make we verify story na"],
  },
  {
    text: "That next-best-couple for UPSA wey dey match outfit everyday for canteen 😍 my guy my GPA dey match like kente design - D for here, F for there, C for corner 😭 Relationship goals plenty but first class no dey. Herrh who we go envy pass? #UPSARealities #CoupleGoalsVsGPA",
    campus: "UPSA", type: "confession", yeahs: 142, boosted: false, comments: ["Give me GPA over couple goals any day","Chale that couple ein GPA be 3.8 oh"],
  },
  {
    text: "Eii that KNUST pure water CEO wey dey hawk for campus in full corporate attire with tie and shiny shoe?? 😂 Boss viral for LinkedIn, TikTok and lecturer WhatsApp group same day! Meanwhile we queue for canteen 45mins for indomie wey boiler no light. Hustle be real! #KNUSTHustle #PureWaterCEO #CanteenQueue",
    campus: "KNUST", type: "meme", yeahs: 251, boosted: true, comments: ["Forbes 30 under 30 loading 😂","45mins?? You lucky, we do 1 hour","KNUST WiFi only work when you no need am"],
  },
]

async function main() {
  console.log("Seeding Ghana fresh feed...")
  const users = []
  for (const g of GHOSTS) {
    const user = await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: {
        email: g.email,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: g.campus,
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }
  console.log(`Upserted ${users.length} ghosts`)

  let postCount = 0
  let commentCount = 0
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i]
    const user = users[i % users.length]
    // Ensure campus matches post campus if ghost campus differs, use post campus but keep user ghost
    const campus = p.campus.includes("University of Ghana") ? "University of Ghana" : p.campus
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        text: p.text,
        type: p.type,
        campus: campus,
        visibility: "school",
        yeahs: p.yeahs,
        commentsCount: p.comments.length,
        boosted: p.boosted,
        boostedUntil: p.boosted ? new Date(Date.now() + 7*24*60*60*1000) : null,
        createdAt: new Date(Date.now() - Math.floor(Math.random()*48*60*60*1000)), // last 48h for ranking
      },
    })
    // hashtags via simple create
    const tags = [...post.text.matchAll(/#(\w+)/g)].map(m=> m[1].toLowerCase())
    for (const tag of [...new Set(tags)]) {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        update: { postsCount: { increment: 1 }, trendingScore: { increment: p.yeahs/10 }, lastUsedAt: new Date() },
        create: { tag, campus: campus, postsCount: 1, trendingScore: p.yeahs/10 },
      })
      await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(()=>{})
    }
    for (const cText of p.comments) {
      const commenter = users[(i+ Math.floor(Math.random()*users.length)) % users.length]
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: commenter.id,
          ghostId: commenter.ghostId,
          text: cText,
        },
      })
      commentCount++
    }
    postCount++
  }
  console.log(`Seeded ${postCount} posts, ${commentCount} comments`)
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())

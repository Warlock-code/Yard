const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const posts = [
  "Why does the WiFi only work when the lecturer is checking attendance",
  "Level 200 hit different fr, nobody warned me",
  "The queue at the canteen is longer than my program duration",
  "Saw someone submit an assignment 2 minutes before deadline and sprint to the lecture hall, respect",
  "Group projects are just one person doing everything and four names on the cover page",
  "Who keeps booking the library seats and not showing up",
  "My lecturer said 'just a quick recap' and that was 45 minutes ago",
  "The struggle of finding a socket in the library during exam week is a whole sport",
  "Nothing hits like free food at a campus event, I don't even care what the event is for",
  "Why is the printer always down exactly when an assignment is due",
  "Campus crushes that never went anywhere, we mourn them silently",
  "The walk from the hostel to first lecture in the rain builds character apparently",
  "Someone please explain why exams and hunger always arrive together",
  "The way attendance sheets disappear right when you need to sign in late",
  "Studying with music vs studying in silence, pick a side",
  "That one friend who never has data but somehow is always online",
  "Group chat goes dead until someone says 'lecture cancelled', then it's chaos",
  "The energy switch from Monday morning to Friday afternoon on campus is wild",
  "Who is setting these assignment deadlines at 11:59pm like we don't sleep",
  "The canteen jollof hits different after a long lecture",
  "Nothing scarier than a lecturer saying 'let's do a pop quiz'",
  "The unspoken rule that if you sit in the front row you must know everything",
  "Why do group project WhatsApp groups always go silent until the night before",
  "The relief when a 3-hour lecture ends 20 minutes early",
  "That awkward moment when you wave at someone who wasn't waving at you",
  "Campus love stories that started in a group chat, we want updates",
  "The mystery of who keeps stealing chairs from the reading room",
  "Nothing like power going off during an online quiz",
  "The 'I'll read it before exams' promise we all break every semester",
  "Who else treats the library as a nap spot during the day",
  "The lecturer who ends every sentence with 'you get me?' and nobody gets it",
  "Trying to explain to your parents why the semester GPA dropped a little",
  "The unofficial competition to see who submits assignments closest to the deadline",
  "That feeling when your group members finally send their part of the assignment",
  "Why is registration week always more stressful than exams",
  "The struggle of finding a quiet spot to call home without everyone hearing",
  "Someone's phone going off in a silent exam hall is a universal fear",
  "The unspoken bond between everyone stuck in the same slow-moving queue",
  "That one lecturer whose class you attend just for the jokes",
  "Trying to nap between lectures and someone starts a loud conversation nearby",
  "The panic of realizing an assignment was due yesterday, not today",
  "Campus WiFi working perfectly until you actually need to submit something",
  "The unofficial rule that hostel food tastes better after 10pm",
  "Nothing like finding out class was cancelled after you already got dressed and left",
  "The mystery of how some people always look put together for 8am lectures",
  "That feeling when a lecturer actually explains something you understand fully",
  "Group discussions where three people talk and the rest just nod",
  "The eternal search for a charging point that actually works",
  "Trying to study but your roommate has other plans for the room",
  "That specific stress of realizing exams start in one week",
  "The lecturer's 'any questions?' met with total silence every single time",
  "Campus gist spreads faster than the WiFi signal, and that's saying something",
  "Someone genuinely thought class ended an hour early and left, respect the confidence",
  "The unspoken agreement to share notes with the person who actually attends every class",
  "Trying to convince yourself 5 hours of sleep before an 8am exam is enough",
  "The specific joy of finding an empty classroom to study alone in",
  "Everyone becomes a genius the night before an exam somehow",
  "The relief of finishing a group presentation without technical issues",
  "Nothing like the silence after a lecturer asks 'does everyone understand'",
  "The unofficial rule that assignments take twice as long as expected, always",
  "That feeling when your favorite canteen item is sold out right before you order",
  "The mystery of who's always laughing loudly in the library",
  "Trying to focus in class while planning what to eat after",
  "The panic when you can't find your student ID during an exam",
  "Someone dozing off in a lecture and waking up mid-sentence pretending to take notes",
  "The specific chaos of registration portal crashing on deadline day",
  "That feeling of finally understanding a topic you struggled with all semester",
  "The unspoken rivalry between different programs on who has it harder",
  "Trying to act normal after seeing your crush on campus unexpectedly",
  "The relief of a lecturer saying 'we'll continue this next week'",
  "Nothing like the last day before holidays, campus feels different",
  "The mystery of how some people finish assignments days before deadline",
  "That awkward silence when a lecturer asks a question and stares at the class",
  "The specific joy of finding your favorite seat empty in the library",
  "Trying to remember what a lecturer said five minutes ago because you were distracted",
  "The unofficial competition for best hostel room setup",
  "Someone's ringtone going off loudly in the middle of a quiet lecture",
  "The panic of realizing you left your assignment on your laptop at the hostel",
  "That feeling when a group member finally does their part without being asked twice",
  "The mystery of who keeps leaving trash in the reading room",
  "Trying to convince your stomach that lunch can wait until after this lecture",
  "The specific stress of exam seating arrangements separating you from your study group",
  "Nothing like power banks becoming the most valuable item on campus during exam week",
  "The unspoken understanding between everyone rushing to beat the closing library hours",
  "That feeling when a lecturer cancels the pop quiz they promised",
  "The mystery of how hostel gossip travels faster than official announcements",
  "Trying to look busy on your phone while actually just avoiding eye contact",
  "The relief of finding parking or a good spot before a popular lecture",
  "Someone confidently answering a question wrong and the whole class going along with it",
  "The specific joy of a lecturer arriving late and class getting cancelled",
  "Nothing like realizing the assignment format was completely different from what you did",
  "The unofficial rule that borrowed pens never come back",
  "Trying to nap in the library without getting caught by security",
  "The mystery of who's always eating loudly during a quiet study session",
  "That feeling when your group finally submits the project with time to spare",
  "The specific stress of technical difficulties during an online exam",
  "Nothing like finding out the assignment deadline got extended after you already stressed all night",
  "The unspoken agreement that finals week friendships are the strongest bonds on campus",
  "Trying to explain campus slang to a new student without sounding confusing",
  "The relief of the semester finally ending and the immediate nostalgia that follows",
]

const CAMPUSES = ["GCTU"]

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
        campus: "GCTU",
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }

  for (let i = 0; i < posts.length; i++) {
    const user = users[i % users.length]
    await prisma.post.create({
      data: {
        userId: user.id,
        text: posts[i],
        type: "confession",
        campus: "GCTU",
        visibility: "school",
        yeahs: Math.floor(Math.random() * 40),
      },
    })
  }

  console.log(`Seeded ${posts.length} posts across ${users.length} ghosts.`)
}

main().finally(() => prisma.$disconnect())
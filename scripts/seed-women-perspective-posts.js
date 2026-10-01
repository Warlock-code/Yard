const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const campus = "GCTU"
const program = "General Studies"
const level = "level 200"
const emailSuffix = "@women-seed.yardapp.me"
const postCount = 200

const authors = [
  ["AmaWrites", "🌻"],
  ["NanaAdwoa", "🦋"],
  ["EsiInTheStacks", "📚"],
  ["AbenaSpeaks", "🌙"],
  ["AkosuaOnCampus", "🌺"],
  ["MimiObserves", "✨"],
  ["YaaThinks", "🌿"],
  ["EfuaSays", "💫"],
]

const topics = [
  ["being underestimated in a group project", "I was assigned the presentation slides before anyone asked what I could actually do. I quietly took responsibility for the research, the analysis, and the final presentation, and the room changed when I started explaining the work. Sometimes competence is the introduction they refused to give you."],
  ["making friends after the first semester", "I used to think everyone had already found their people, so I kept waiting for an invitation. The truth is that several girls around me were waiting too. One honest conversation after class became lunch, then a study session, and now I have people who notice when I am missing."],
  ["walking across campus after dark", "I plan my route home before I leave the library, keep my phone charged, and message someone when I start walking. It is tiring to carry that calculation while everyone else simply heads home, but looking after myself is not an overreaction. It is part of being allowed to move through campus safely."],
  ["the pressure to look composed", "There are days when my outfit is neat, my notes are open, and I still feel completely lost. Looking organised is not proof that life is easy. I am learning that I can be capable and still ask for help before everything becomes an emergency."],
  ["speaking up in class", "I rehearsed my question three times because I did not want to sound foolish. When I finally asked it, two other students admitted they were confused too. A thoughtful question does not make you less intelligent; sometimes it gives the whole room permission to understand."],
  ["balancing school and family expectations", "I love my family, but love does not mean I can answer every call, solve every problem, and still study as if I have unlimited energy. I am learning to say, kindly and clearly, what I can manage this week. Boundaries are not disrespect."],
  ["finding confidence after a disappointing grade", "I stared at the mark for a long time and decided it had become a verdict on my ability. After I reviewed the feedback, it became something more useful: a map of what to practise. I am disappointed, but I am not finished, and one result cannot speak for my whole future."],
  ["the quiet work behind academic success", "People see the good result, not the early mornings, the rewritten notes, or the weekends I declined because I needed to catch up. I am proud of the discipline, but I also want us to stop pretending achievement should always look effortless."],
  ["setting boundaries with a friend", "I kept accepting jokes that hurt because I was afraid one serious conversation would end the friendship. When I finally explained how I felt, the friendship did not collapse. It became more honest. The people who care about you should not require you to disappear to keep them comfortable."],
  ["campus dating and clear communication", "I do not think asking what someone wants is too serious for a first conversation. Clarity saves everyone time and prevents a lot of unnecessary guessing. I would rather hear an honest answer early than build a whole relationship around assumptions."],
  ["being the dependable daughter", "Being the responsible one can become a role people stop questioning. Everyone assumes I will remember the deadline, make the call, and keep the peace. I am grateful to be trusted, but I am also allowed to have an off day without becoming a disappointment."],
  ["sharing a room and protecting study time", "My roommate and I had different ideas of what quiet meant, so I stopped hoping we would magically adjust. We agreed on two study windows and a simple signal when either of us needed space. A respectful conversation solved what silent resentment never could."],
  ["asking for help with money", "I used to feel ashamed whenever I could not join a plan or pay for something immediately. Now I try to be honest instead of inventing excuses. Financial pressure is real for many students, and pretending otherwise only makes people feel more alone."],
  ["being judged for ambition", "The moment I said I wanted more, someone asked whether I was becoming difficult. I am not interested in making myself smaller so my goals feel polite to other people. Ambition with kindness is still ambition, and I am allowed to want a life that fits me."],
  ["recovering from burnout", "I thought rest had to be earned by reaching complete exhaustion. That belief made every break feel guilty and every task feel heavier. I am rebuilding a routine that includes sleep, food, and quiet time before my body forces the issue."],
  ["supporting another woman in public", "A girl looked uncomfortable while someone kept interrupting her, so I asked her to finish her point and then turned the attention back to her. It took seconds. Small acts of solidarity matter because they tell people they are not invisible."],
  ["being taken seriously in technical work", "I have learned to put my ideas in writing, keep records, and speak with enough confidence that my contribution cannot be edited out of the conversation. It should not be necessary, but until the standard changes, I refuse to let other people's assumptions decide what I know."],
  ["choosing peace over a campus argument", "I used to believe every misunderstanding needed an immediate explanation. Now I ask whether the conversation will create understanding or simply give someone more access to my energy. Walking away is not always avoidance; sometimes it is a deliberate choice to protect my peace."],
  ["learning to celebrate small wins", "Today I submitted an assignment before midnight, drank enough water, and replied to a message I had been avoiding. None of it looks dramatic, but I know how much effort those ordinary things took this week. Small wins deserve to be counted too."],
  ["preparing for life after graduation", "The future feels exciting and frightening in equal measure. I do not have every step planned, but I am building useful skills, asking better questions, and keeping people around me who tell me the truth. A clear direction can grow while you are already moving."],
]

const angles = [
  "This happened to me this week, and I am still thinking about it.",
  "I am sharing this because someone else may be carrying the same feeling quietly.",
  "The older I get, the more I realise that the small moments teach me the most.",
  "I wish someone had said this to me when I first arrived on campus.",
  "I am not looking for perfection here; I am trying to be honest about the lesson.",
  "There is a difference between being strong and pretending that nothing affects you.",
  "I hope this encourages someone to choose themselves without becoming unkind.",
  "The conversation was uncomfortable, but the silence had already become too expensive.",
  "I am learning that confidence is often just preparation plus the courage to be seen.",
  "Maybe this is ordinary, but ordinary experiences shape how safe and welcome campus feels.",
]

const commentOpeners = [
  "Thank you for putting this into words.",
  "I needed to read this today.",
  "The part about preparation really stayed with me.",
  "I have had a similar experience, although I handled it less calmly.",
  "This is a useful reminder that we rarely see the full story behind a result.",
  "I appreciate how honest this is without turning the situation into a performance.",
]

const commentEndings = [
  "I hope you keep choosing the approach that protects your peace.",
  "That kind of clarity makes it easier for other people to be honest too.",
  "You are allowed to take up space without apologising for it.",
  "The right people will respect the boundary even if they need time to understand it.",
  "I am going to remember this the next time I start doubting myself.",
  "There is real strength in making a thoughtful decision instead of a loud one.",
]

function emailFor(ghostId) {
  return `${ghostId.toLowerCase()}${emailSuffix}`
}

function postId(index) {
  return `women_perspective_post_${index + 1}`
}

function commentId(postIndex, commentIndex) {
  return `women_perspective_comment_${postIndex + 1}_${commentIndex + 1}`
}

function postText(index) {
  const [topic, body] = topics[index % topics.length]
  const angle = angles[Math.floor(index / topics.length) % angles.length]
  return `${angle} This is about ${topic}. ${body}`.toLowerCase()
}

function commentText(postIndex, commentIndex) {
  const [topic] = topics[postIndex % topics.length]
  const opener = commentOpeners[commentIndex]
  const ending = commentEndings[(postIndex + commentIndex) % commentEndings.length]
  return `${opener} The part about ${topic} is especially familiar because many students are expected to manage it quietly. I am trying to respond to situations like this with more patience, clearer communication, and less fear of disappointing people. ${ending}`.toLowerCase()
}

async function ensureUsers() {
  const users = []
  for (const [ghostId, avatarEmoji] of authors) {
    users.push(await prisma.user.upsert({
      where: { email: emailFor(ghostId) },
      update: { campus, avatarEmoji, program, programLevel: level },
      create: {
        email: emailFor(ghostId),
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus,
        program,
        programLevel: level,
        ghostId,
        avatarEmoji,
      },
    }))
  }

  for (let index = 0; index < 12; index += 1) {
    const ghostId = `ThoughtfulReply${index + 1}`
    users.push(await prisma.user.upsert({
      where: { email: emailFor(ghostId) },
      update: { campus, avatarEmoji: "💬", program, programLevel: level },
      create: {
        email: emailFor(ghostId),
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus,
        program,
        programLevel: level,
        ghostId,
        avatarEmoji: "💬",
      },
    }))
  }
  return users
}

async function seedPost(index, users) {
  const author = users[index % authors.length]
  const id = postId(index)
  const text = postText(index)
  const createdAt = new Date(Date.now() - (index + 1) * 37 * 60 * 1000)

  await prisma.comment.deleteMany({ where: { postId: id } })
  const post = await prisma.post.upsert({
    where: { id },
    update: {
      userId: author.id,
      text,
      type: index % 5 === 0 ? "gossip" : "confession",
      campus,
      program,
      programLevel: level,
      visibility: "school",
      archived: false,
      commentsCount: 6,
      yeahs: 8 + (index % 31),
      createdAt,
    },
    create: {
      id,
      userId: author.id,
      text,
      type: index % 5 === 0 ? "gossip" : "confession",
      campus,
      program,
      programLevel: level,
      visibility: "school",
      commentsCount: 6,
      yeahs: 8 + (index % 31),
      createdAt,
    },
  })

  await prisma.comment.createMany({
    data: Array.from({ length: 6 }, (_, commentIndex) => {
      const commenter = users[authors.length + ((index + commentIndex) % 12)]
      return {
        id: commentId(index, commentIndex),
        postId: post.id,
        userId: commenter.id,
        ghostId: commenter.ghostId,
        text: commentText(index, commentIndex),
        yeahs: 1 + ((index + commentIndex) % 8),
        createdAt: new Date(createdAt.getTime() + (commentIndex + 1) * 12 * 60 * 1000),
      }
    }),
  })

  return { userId: author.id, text }
}

async function main() {
  const users = await ensureUsers()
  for (let index = 0; index < postCount; index += 1) {
    await seedPost(index, users)
    if ((index + 1) % 25 === 0) console.log(`seeded ${index + 1}/${postCount} posts`)
  }

  const allUsers = await prisma.user.findMany({ select: { id: true } })
  for (const user of allUsers) {
    const [posts, media] = await Promise.all([
      prisma.post.findMany({ where: { userId: user.id }, select: { text: true } }),
      prisma.mediaUpload.aggregate({ where: { userId: user.id }, _sum: { sizeBytes: true } }),
    ])
    const textBytes = posts.reduce((total, post) => total + Buffer.byteLength(post.text || "", "utf8"), 0)
    const mediaBytes = media._sum.sizeBytes || 0
    await prisma.user.update({
      where: { id: user.id },
      data: { storageUsed: (textBytes + mediaBytes) / (1024 * 1024) },
    })
  }
  console.log(`seeded ${postCount} women-perspective posts with ${postCount * 6} comments`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())

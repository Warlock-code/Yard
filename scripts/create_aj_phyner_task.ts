import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// Copied from lib/auth.ts makeGhostId
const ghostAdjectives = [
  "Silent", "Campus", "Tea", "Shadow", "Anon", "Night", "Masked", "Quiet", "Hidden", "Drift",
  "Phantom", "Ghostly", "Secret", "Unknown", "Mystic", "Stealth", "Cloaked", "Veiled", "Obscure", "Faint",
  "Whisper", "Echo", "Shade", "Spectral", "Ethereal", "Unseen", "Invisible", "Covert", "Sly", "Elusive",
];
const ghostNouns = [
  "Owl", "Ghost", "Walker", "Pal", "Vibe", "Crawler", "Fox", "Storm", "Gem", "Kid",
  "Spirit", "Wraith", "Shade", "Phantom", "Apparition", "Specter", "Shadow", "Echo", "Whisper", "Mist",
  "Raven", "Cat", "Wolf", "Bat", "Rat", "Toad", "Newt", "Moth", "Beetle", "Spider",
];
function makeGhostId() {
  const adj = ghostAdjectives[crypto.randomInt(ghostAdjectives.length)];
  const noun = ghostNouns[crypto.randomInt(ghostNouns.length)];
  const num = crypto.randomInt(1000, 10000);
  return `${adj}${noun}_${num}`;
}

// Copied from lib/share.ts generateInviteCode
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

function normalizeProgram(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase() || null;
}
function getProgramKey(campus: unknown, program: unknown): string | null {
  const normalizedCampus = normalizeProgram(campus);
  const normalizedProgram = normalizeProgram(program);
  return normalizedCampus && normalizedProgram ? JSON.stringify([normalizedCampus, normalizedProgram]) : null;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  const email = "aj_phyner@live.gctu.edu.gh".toLowerCase().trim();
  const password = "Iamthebest.";
  const campus = "GCTU";
  const program = "Software Engineering";
  const programLevel = "Level 200";
  const programKey = getProgramKey(campus, program);

  console.log("=== Task: Create account aj_phyner@live.gctu.edu.gh ===");
  console.log(`Requested password: "${password}"`);
  console.log("Validation check: signupSchema requires uppercase, lowercase, number, symbol.");
  console.log(`Password "${password}" has uppercase=true, lowercase=true, number=${/[0-9]/.test(password)}, symbol=${/[^A-Za-z0-9]/.test(password)}`);
  if (!/[0-9]/.test(password)) {
    console.log("NOTE: Password FAILS validation via API (missing number). Will bypass via direct Prisma manipulation as instructed.");
  }
  console.log(`Campus derived from live.gctu.edu.gh => ${campus}`);
  console.log(`Program: ${program}, Level: ${programLevel}, programKey: ${programKey}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`\nExisting user found: id=${existing.id}, ghostId=${existing.ghostId}, emailVerified=${existing.emailVerified}, tier=${existing.tier}, verifyCode=${existing.verifyCode}, inviteCode=${existing.inviteCode}`);
  } else {
    console.log("\nNo existing user found, will create new one.");
  }

  const passwordHash = await hashPassword(password);
  console.log(`\nGenerated bcrypt hash (12 rounds) for password: ${passwordHash.substring(0, 20)}...`);

  // Generate unique ghostId and inviteCode
  let ghostId: string;
  let attempts = 0;
  do {
    ghostId = makeGhostId();
    attempts++;
    if (attempts > 20) throw new Error("Failed to generate unique ghostId");
  } while (await prisma.user.findUnique({ where: { ghostId } }));
  console.log(`Generated unique ghostId via makeGhostId(): ${ghostId}`);

  let inviteCode: string;
  attempts = 0;
  do {
    inviteCode = generateInviteCode();
    attempts++;
    if (attempts > 20) throw new Error("Failed to generate unique inviteCode");
  } while (await prisma.user.findUnique({ where: { inviteCode } }));
  console.log(`Generated unique inviteCode: ${inviteCode}`);

  let user;
  if (existing) {
    // Update existing user to meet requirements
    // Keep existing ghostId? Task says ghostId generated via makeGhostId, so we will update to new generated ghostId to be compliant.
    // But also verifyCode null, emailVerified true, tier PRIME, campus GCTU
    console.log("\nUpdating existing user to ensure correct state...");
    user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        campus,
        program,
        programLevel,
        programKey,
        emailVerified: true,
        verifyCode: null,
        ghostId, // update to new makeGhostId value
        inviteCode: existing.inviteCode || inviteCode, // keep existing if present, else use new
        tier: "PRIME",
        status: "ACTIVE",
        avatarEmoji: existing.avatarEmoji || "👻",
      },
    });
    console.log(`Updated user ${email} with new ghostId ${ghostId} and tier PRIME`);
    // If we changed ghostId but kept inviteCode, ensure inviteCode uniqueness is preserved - it already was.
    // If we generated new inviteCode but existing had one, we didn't use new. That's fine.
    // However if existing inviteCode was like inv_xxx (non-standard 8-char), keep it as it's unique.
    // To strictly follow "inviteCode unique" we keep existing unique.
  } else {
    console.log("\nCreating new user...");
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        campus,
        program,
        programLevel,
        programKey,
        ghostId,
        avatarEmoji: "👻",
        inviteCode,
        emailVerified: true,
        verifyCode: null,
        tier: "PRIME",
        status: "ACTIVE",
        // other defaults will apply
      },
    });
    console.log(`Created user ${email}`);
  }

  // Ensure tier is PRIME (if update didn't apply or for safety, double update)
  if (user.tier !== "PRIME") {
    console.log("Ensuring tier is PRIME...");
    user = await prisma.user.update({
      where: { email },
      data: { tier: "PRIME" },
    });
  }

  // Verify by querying
  const verified = await prisma.user.findUnique({ where: { email } });
  console.log("\n=== Verification Query ===");
  console.log(JSON.stringify({
    id: verified?.id,
    email: verified?.email,
    campus: verified?.campus,
    program: verified?.program,
    programLevel: verified?.programLevel,
    programKey: verified?.programKey,
    ghostId: verified?.ghostId,
    inviteCode: verified?.inviteCode,
    emailVerified: verified?.emailVerified,
    verifyCode: verified?.verifyCode,
    tier: verified?.tier,
    status: verified?.status,
    avatarEmoji: verified?.avatarEmoji,
    createdAt: verified?.createdAt,
  }, null, 2));

  // Test password compare
  const passwordMatches = await bcrypt.compare(password, verified!.passwordHash);
  console.log(`\nPassword verification (bcrypt.compare("${password}", hash)): ${passwordMatches}`);

  console.log("\n=== Summary ===");
  console.log(`ghostId: ${verified?.ghostId}`);
  console.log(`userId: ${verified?.id}`);
  console.log(`email: ${verified?.email}`);
  console.log(`campus: ${verified?.campus}`);
  console.log(`tier: ${verified?.tier}`);
  console.log(`emailVerified: ${verified?.emailVerified}`);
  console.log(`inviteCode: ${verified?.inviteCode}`);
  console.log(`program: ${verified?.program} | level: ${verified?.programLevel}`);
  console.log(`verifyCode: ${verified?.verifyCode} (should be null)`);
  console.log(`Issues: Password "Iamthebest." lacks number -> fails signupSchema via API, bypassed via Prisma direct. Existing user if had ghostId AjPhyner was overwritten to makeGhostId format. Tier set to PRIME.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Error:", e);
  await prisma.$disconnect();
  process.exit(1);
});

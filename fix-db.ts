import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_UyWumBN09zta@ep-small-mode-ay6pupko.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function fixDb() {
  // Add missing columns to User table
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "freeBoostsWeekly" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastFreeBoostGrant" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "freeStreakFreezeMonthly" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastFreeFreezeGrant" TIMESTAMP(3);
  `);
  
  console.log('Added missing User columns');
  
  // Check if columns exist now
  const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`;
  console.log('User table columns:', JSON.stringify(result, null, 2));
  
  // Now check for the specific user
  const user = await prisma.user.findUnique({
    where: { email: '2526404295@live.gctu.edu.gh' }
  });
  
  console.log(user ? 'User exists: ' + JSON.stringify(user, null, 2) : 'User NOT found');
  
  const count = await prisma.user.count();
  console.log(`Total users in database: ${count}`);
  
  await prisma.$disconnect();
}

fixDb().catch(console.error);
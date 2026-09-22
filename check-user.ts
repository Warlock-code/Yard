import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { email: '2526404295@live.gctu.edu.gh' }
  });
  
  console.log(user ? 'User exists: ' + JSON.stringify(user, null, 2) : 'User NOT found');
  
  // Also check total user count
  const count = await prisma.user.count();
  console.log(`Total users in database: ${count}`);
  
  await prisma.$disconnect();
}

checkUser().catch(console.error);
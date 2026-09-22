import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDb() {
  const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`;
  console.log('User table columns:', JSON.stringify(result, null, 2));
  
  await prisma.$disconnect();
}

checkDb().catch(console.error);
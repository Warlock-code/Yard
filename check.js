const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.post.count().then(c => console.log('Total posts:', c)).finally(() => prisma.$disconnect());
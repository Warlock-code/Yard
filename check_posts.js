const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get sample posts
  const posts = await prisma.post.findMany({
    take: 3,
    orderBy: { id: 'desc' },
    select: { id: true, text: true, campus: true, type: true, yeahs: true }
  });
  console.log('Sample posts (last 3):');
  posts.forEach((p, i) => {
    console.log(`${i+1}. ID: ${p.id}`);
    console.log(`   Campus: ${p.campus}, Type: ${p.type}, Yeahs: ${p.yeahs}`);
    console.log(`   Text: ${p.text.substring(0, 100)}...`);
    console.log();
  });
  
  // Count total
  const count = await prisma.post.count();
  console.log(`Total posts in database: ${count}`);
  
  // Check a few more details
  const sample = await prisma.post.findMany({
    take: 5,
    select: { id: true, campus: true, type: true }
  });
  console.log('\\nPost distribution:');
  const counts = {};
  sample.forEach(p => {
    const key = `${p.campus}-${p.type}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(JSON.stringify(counts, null, 2));
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
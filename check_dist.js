const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all posts with campus and type
  const posts = await prisma.post.findMany({
    select: { id: true, campus: true, type: true, yeahs: true }
  });
  
  const count = posts.length;
  console.log(`Total posts: ${count}`);
  
  // Distribution by campus
  const campusCounts = {};
  const typeCounts = {};
  
  posts.forEach(p => {
    campusCounts[p.campus] = (campusCounts[p.campus] || 0) + 1;
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  });
  
  console.log('\\nBy campus:');
  console.log(JSON.stringify(campusCounts, null, 2));
  
  console.log('\\nBy type:');
  console.log(JSON.stringify(typeCounts, null, 2));
  
  // Sample some IDs to see the pattern
  console.log('\\nSample IDs:');
  const sampleIds = posts.slice(0, 10).map(p => p.id);
  console.log(sampleIds);
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
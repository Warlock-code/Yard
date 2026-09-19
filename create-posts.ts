import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PostData {
  id: string;
  text: string;
  type: string;
  campus: string;
  hashtags: string[];
  comments: Array<{
    ghostId: string;
    avatarEmoji: string;
    text: string;
  }>;
  boosted?: boolean;
  boostedUntil?: string;
  yeahs?: number;
}

// Get the current max post ID number to ensure unique IDs
async function getMaxPostIndex(): Promise<number> {
  try {
    const posts = await prisma.post.findMany({
      select: { id: true },
      take: 1,
      orderBy: { id: 'desc' },
    });
    if (posts.length === 0) return 0;
    // Extract number from ID like post_UCC_266 or post_UNI_100
    const lastId = posts[0].id;
    const match = lastId.match(/_(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  } catch (e) {
    return 0;
  }
}

// Ensure a user exists and return their ID
async function getOrCreateUser(campus: string): Promise<string> {
  // Try to find an existing user with this campus
  const existingUser = await prisma.user.findFirst({
    where: { campus },
    select: { id: true },
  });

  if (existingUser) {
    return existingUser.id;
  }

  // Create a new user - simplified without relational fields for now
  const newUser = await prisma.user.create({
    data: {
      email: `student_${Math.random().toString(36).substring(2, 10)}@university.edu`,
      passwordHash: '$2a$10$fakehash',
      emailVerified: false,
      campus: campus,
      ghostId: `ghost_${Math.random().toString(36).substring(2, 8)}`,
      avatarEmoji: ['👻', '🐍', '👽', '🦇'][Math.floor(Math.random() * 4)],
      tier: Math.random() > 0.7 ? 'PRIME' : 'FREE',
      status: 'ACTIVE',
      // Omit relational fields for now - they have defaults
      ghostCoins: Math.floor(Math.random() * 1000),
      freeBoosts: Math.floor(Math.random() * 10),
      storageUsed: Math.random() * 50,
      storageLimit: 50,
      battleChampion: false,
      weeklyChampion: false,
      inviteCode: `inv_${Math.random().toString(36).substring(2, 10)}`,
      referralCount: 0,
      streakCount: 0,
      createdAt: new Date(),
    },
  });

  return newUser.id;
}

async function createPost(post: PostData, campus: string, startIndex: number): Promise<any> {
  try {
    const userId = await getOrCreateUser(campus);
    
    // Create a unique post ID using startIndex + offset for each post in batch
    const batchSize = 5; // posts per batch
    
    for (let i = 0; i < post.comments.length || i < 1; i++) {
      const postIndex = startIndex + i;
      const uniquePostId = `post_${campus.substring(0, 3).toUpperCase()}_${postIndex}`;
      
      // Create the post
      const newPost = await prisma.post.create({
        data: {
          id: uniquePostId,
          userId: userId,
          text: post.text,
          type: post.type,
          campus: post.campus,
          visibility: Math.random() > 0.5 ? "school" : "program",
          yeahs: post.yeahs || Math.floor(Math.random() * 500) + 10,
          commentsCount: post.comments.length,
          boosted: post.boosted || false,
          boostedUntil: post.boostedUntil || null,
          isPrime: Math.random() > 0.8, // 20% prime users
        },
      });

      // Create comments for the post with unique IDs
      if (post.comments.length > 0) {
        const comment = post.comments[0]; // Create at least one comment
        const commentId = `comment_${uniquePostId}_0`;
        await prisma.comment.create({
          data: {
            id: commentId,
            postId: uniquePostId,
            userId,
            ghostId: comment.ghostId,
            text: comment.text,
            parentId: null, // Top-level comment
          },
        });
      }

      console.log(`Created post ${uniquePostId} with comments on ${post.campus}`);
      return newPost;
    }
  } catch (error) {
    console.error(`Error creating post:`, error);
    throw error;
  }
}

async function main() {
  // Read generated posts
  const fs = require('fs');
  const postsData = JSON.parse(fs.readFileSync('generated-posts.json', 'utf8'));
  
  console.log(`Loading ${postsData.length} posts from generated-data...`);
  
  // Get the starting index based on existing posts
  const maxIndex = await getMaxPostIndex();
  console.log(`Current max post index: ${maxIndex}`);
  
  // Process posts in batches to avoid overwhelming the database
  const batchSize = 5;
  const totalPosts = postsData.length;
  let currentIndex = maxIndex;
  
  for (let i = 0; i < totalPosts; i += batchSize) {
    const batch = postsData.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalPosts / batchSize)} (posts ${i + 1}-${Math.min(i + batchSize, totalPosts)}) starting at index ${currentIndex}`);
    
    const promises = batch.map((post: any, idx: number) => createPost(post, post.campus, currentIndex + idx));
    
    await Promise.all(promises);
    
    currentIndex += batchSize;
  }
  
  console.log(`Successfully created posts starting from index ${maxIndex}!`);
  
  // Close the prisma client
  await prisma.$disconnect();
}

main()
  .then(async () => {
    console.log('Post creation complete!');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error during post creation:', e);
    process.exit(1);
  });
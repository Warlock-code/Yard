// Database post creation script using Prisma
// This script will create posts and comments from the generated data

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

async function createPost(post: PostData) {
  try {
    // Create the post
    const newPost = await prisma.post.create({
      data: {
        id: post.id,
        userId: `user_${Math.floor(Math.random() * 1000)}`, // Generate a user ID
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

    // Create comments for the post
    for (const comment of post.comments) {
      await prisma.comment.create({
        data: {
          id: `comment_${post.id}_${comment.ghostId}`,
          postId: post.id,
          userId: `user_${Math.floor(Math.random() * 1000)}`,
          ghostId: comment.ghostId,
          text: comment.text,
          parentId: null, // Top-level comment
        },
      });
    }

    console.log(`Created post ${post.id} with ${post.comments.length} comments on ${post.campus}`);
    return newPost;
  } catch (error) {
    console.error(`Error creating post ${post.id}:`, error);
    throw error;
  }
}

async function main() {
  // Read generated posts
  const fs = require('fs');
  const postsData = JSON.parse(fs.readFileSync('generated-posts.json', 'utf8'));
  
  console.log(`Loading ${postsData.length} posts from generated-data...`);
  
  // Process posts in batches to avoid overwhelming the database
  const batchSize = 10;
  const totalPosts = postsData.length;
  
  for (let i = 0; i < totalPosts; i += batchSize) {
    const batch = postsData.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalPosts / batchSize)} (posts ${i + 1}-${Math.min(i + batchSize, totalPosts)})`);
    
    const promises = batch.map((post: any) => createPost({
      id: post.id,
      text: post.text,
      type: post.type,
      campus: post.campus,
      hashtags: post.hashtags,
      comments: post.comments,
      boosted: post.boosted,
      boostedUntil: post.boostedUntil,
      yeahs: post.yeahs,
    }));
    
    await Promise.all(promises);
  }
  
  console.log(`Successfully created ${totalPosts} posts!`);
  
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
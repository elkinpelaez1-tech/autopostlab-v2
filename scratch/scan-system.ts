
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SCANNING ALL SOCIAL ACCOUNTS ---');
  const accs = await prisma.socialAccount.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      workspaceId: true,
      createdAt: true
    }
  });
  console.log(JSON.stringify(accs, null, 2));

  console.log('\n--- SCANNING ALL POSTS (LAST 24H) ---');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: {
      createdAt: {
        gte: yesterday
      }
    },
    include: {
      scheduledPosts: true
    }
  });
  console.log(JSON.stringify(posts, null, 2));
}

main().finally(() => prisma.$disconnect());

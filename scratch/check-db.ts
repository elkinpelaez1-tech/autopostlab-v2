
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Users ---');
  const users = await prisma.user.findMany({
    take: 5,
    include: {
      ownedWorkspaces: {
        include: {
          socialAccounts: true
        }
      }
    }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('\n--- Checking Posts Today ---');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const posts = await prisma.post.findMany({
    where: {
      createdAt: {
        gte: today
      }
    },
    include: {
      scheduledPosts: true
    }
  });
  console.log('Posts found today:', posts.length);
  console.log(JSON.stringify(posts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserAvatar() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      avatarUrl: true
    }
  });

  console.log('--- User Avatars ---');
  console.dir(users, { depth: null });
  await prisma.$disconnect();
}

checkUserAvatar();


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const postCount = await prisma.post.count();
  const accounts = await prisma.socialAccount.findMany();

  console.log('--- DB Audit ---');
  console.log('Total Social Accounts:', accounts.length);
  console.log('Accounts Detail:', JSON.stringify(accounts.map(a => ({ id: a.id, username: a.username, workspaceId: a.workspaceId, createdAt: a.createdAt })), null, 2));
  console.log('Total Posts:', postCount);
  console.log('--- End Audit ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

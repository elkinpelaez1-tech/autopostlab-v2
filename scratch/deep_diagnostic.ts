
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('--- Latest 5 Social Accounts ---');
  console.log(JSON.stringify(accounts, null, 2));
  
  const workspaces = await prisma.workspace.findMany();
  console.log('--- Workspaces ---');
  console.log(JSON.stringify(workspaces, null, 2));

  const users = await prisma.user.findMany();
  console.log('--- Users ---');
  console.log(JSON.stringify(users.map(u => ({ id: u.id, email: u.email })), null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

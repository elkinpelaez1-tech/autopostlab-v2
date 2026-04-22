
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId: 'cmnuexlk30001lfyk0m7420w9',
    },
  });

  console.log('--- Social Accounts Found ---');
  console.log(JSON.stringify(accounts, null, 2));
  console.log('--- End of List ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

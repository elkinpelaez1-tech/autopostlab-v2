
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- LATEST SOCIAL ACCOUNTS ---');
  const accs = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      workspace: {
        include: {
          owner: true
        }
      }
    }
  });
  console.log(JSON.stringify(accs, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

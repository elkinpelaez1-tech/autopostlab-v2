
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL SOCIAL ACCOUNTS ---');
  const accs = await prisma.socialAccount.findMany({
    include: {
      workspace: true
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

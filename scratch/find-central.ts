
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Finding Account "Central" ---');
  const accs = await prisma.socialAccount.findMany({
    where: {
      OR: [
        { displayName: { contains: 'Central', mode: 'insensitive' } },
        { username: { contains: 'Central', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Results:', JSON.stringify(accs, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

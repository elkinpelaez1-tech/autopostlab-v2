
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allAccounts = await prisma.socialAccount.findMany();

  console.log('--- All Social Accounts ---');
  console.log(JSON.stringify(allAccounts, null, 2));
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

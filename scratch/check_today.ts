
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const account = await prisma.socialAccount.findFirst({
    where: {
      createdAt: {
        gte: new Date(new Date().setHours(0,0,0,0))
      }
    }
  });

  if (account) {
    console.log('✅ Found account created today:');
    console.log(JSON.stringify(account, null, 2));
  } else {
    console.log('❌ No accounts found created today.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

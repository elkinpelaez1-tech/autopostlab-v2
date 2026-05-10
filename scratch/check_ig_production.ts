import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 [DB AUDIT] Querying SocialAccount table for provider = INSTAGRAM...');
  const accounts = await prisma.socialAccount.findMany({
    where: {
      provider: 'INSTAGRAM',
    },
  });

  console.log(`📌 Found ${accounts.length} Instagram account(s) in production DB:`);
  console.log(JSON.stringify(accounts, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

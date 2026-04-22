import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      provider: 'TIKTOK'
    }
  });

  console.log("TikTok Accounts in DB:", JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const failedPosts = await prisma.scheduledPost.findMany({
    where: { status: 'FAILED' },
    orderBy: { scheduledAt: 'desc' },
    take: 3,
    include: {
      socialAccount: true
    }
  });

  console.log('--- ÚLTIMOS ERRORES ---');
  failedPosts.forEach((sp, i) => {
    console.log(`${i+1}. [${sp.socialAccount.provider}] Error: ${sp.errorMessage}`);
    console.log(`   Fecha: ${sp.scheduledAt}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
